import os

path = os.path.join("backend", "app", "services", "report_service.py")
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

# Replace _get_event_observations
old_obs = '''    @staticmethod
    def _get_event_observations(
        session: Session,
        event: ThermalEvent,
    ) -> list[ThermalObservation]:
        """Return the selected event'\''s linked observations in time order."""
        return (
            session.query(ThermalObservation)
            .join(
                EventObservation,
                EventObservation.observation_id == ThermalObservation.id,
            )
            .filter(EventObservation.event_id == event.id)
            .order_by(ThermalObservation.observation_timestamp_utc.asc())
            .all()
        )'''

new_obs = '''    @staticmethod
    def _get_event_observations(
        session: Session,
        event: ThermalEvent,
    ) -> list[ThermalObservation]:
        """Return the selected event'\''s linked observations in time order with PostGIS spatial fallback."""
        obs = (
            session.query(ThermalObservation)
            .join(
                EventObservation,
                EventObservation.observation_id == ThermalObservation.id,
            )
            .filter(EventObservation.event_id == event.id)
            .order_by(ThermalObservation.observation_timestamp_utc.asc())
            .all()
        )
        if not obs and event.longitude is not None and event.latitude is not None:
            try:
                event_geog = cast(
                    func.ST_SetSRID(
                        func.ST_MakePoint(float(event.longitude), float(event.latitude)),
                        4326,
                    ),
                    Geography,
                )
                obs_geog = cast(ThermalObservation.geom, Geography)
                obs = (
                    session.query(ThermalObservation)
                    .filter(func.ST_DWithin(obs_geog, event_geog, 35000))
                    .order_by(func.ST_Distance(obs_geog, event_geog).asc())
                    .limit(10)
                    .all()
                )
            except Exception:
                logger.warning("Spatial observation fallback query failed for %s", event.event_id, exc_info=True)
        return obs

    @staticmethod
    def _get_nearby_events(
        session: Session,
        event: ThermalEvent,
        radius_m: int = 75000,
        limit: int = 5,
    ) -> list[Dict[str, Any]]:
        """Return concurrent active thermal events nearest to this event within radius."""
        if event.longitude is None or event.latitude is None:
            return []
        try:
            from sqlalchemy import Float as SaFloat
            event_geog = cast(
                func.ST_SetSRID(
                    func.ST_MakePoint(float(event.longitude), float(event.latitude)),
                    4326,
                ),
                Geography,
            )
            evt_geog = cast(
                func.ST_SetSRID(
                    func.ST_MakePoint(cast(ThermalEvent.longitude, SaFloat), cast(ThermalEvent.latitude, SaFloat)),
                    4326,
                ),
                Geography,
            )
            distance_m = func.ST_Distance(evt_geog, event_geog).label("distance_m")
            rows = (
                session.query(ThermalEvent, distance_m)
                .filter(ThermalEvent.id != event.id)
                .filter(func.ST_DWithin(evt_geog, event_geog, radius_m))
                .order_by(distance_m.asc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "event_id": item.event_id,
                    "classification": item.classification,
                    "anomaly_tier": item.anomaly_tier,
                    "peak_frp_mw": float(item.peak_frp_mw or 0.0),
                    "distance_km": round(float(dist) / 1000.0, 1),
                    "latitude": float(item.latitude),
                    "longitude": float(item.longitude),
                    "latest_detected_utc": item.latest_detected_utc.strftime("%Y-%m-%d %H:%M") if item.latest_detected_utc else "N/A",
                }
                for item, dist in rows
            ]
        except Exception:
            logger.warning("Nearby events query failed for %s", event.event_id, exc_info=True)
            return []'''

if "def _get_event_observations" in code:
    idx_start = code.find("    @staticmethod\n    def _get_event_observations")
    idx_end = code.find("    @staticmethod\n    def _get_nearby_facilities")
    if idx_start != -1 and idx_end != -1:
        code = code[:idx_start] + new_obs + "\n\n" + code[idx_end:]

# Assign nearby_events in get_report_view_model
if 'report_data["nearby_events"]' not in code:
    target_pos = code.find('report_data["facility_search_radius_km"] = None')
    if target_pos != -1:
        insert_code = '''
        report_data["nearby_events"] = ReportService._get_nearby_events(
            session=session,
            event=event,
            radius_m=75000,
            limit=5,
        )'''
        end_try = code.find('\n        historical_events, history_basis', target_pos)
        if end_try != -1:
            code = code[:end_try] + insert_code + code[end_try:]

with open(path, "w", encoding="utf-8") as f:
    f.write(code)

print("SUCCESS: Patched report_service.py!")