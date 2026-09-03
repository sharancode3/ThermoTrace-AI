"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Filter, MapPin, Newspaper, RefreshCw, Search, X, Radio } from "lucide-react";

interface NewsItem {
  id: string;
  event_id: string;
  headline: string;
  summary: string;
  severity_tag?: string;
  anomaly_tier?: string;
  classification?: string;
  location_name?: string;
  peak_frp_mw?: number;
  confidence_pct?: number;
  published_at?: string;
}

function normalizeNews(payload: any): NewsItem[] {
  if (Array.isArray(payload)) return payload as NewsItem[];
  if (Array.isArray(payload?.news)) return payload.news as NewsItem[];
  if (Array.isArray(payload?.data)) return payload.data as NewsItem[];
  return [];
}

function formatTime(value?: string) {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(value?: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago (${formatTime(value)})`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago (${formatTime(value)})`;
}

export function NewsPanel({
  open = true,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastPolledAt, setLastPolledAt] = useState<string | null>(null);
  const [recordsPulled, setRecordsPulled] = useState<number | null>(null);

  const handleSelectNewsEvent = (item: NewsItem) => {
    if (!item.event_id) return;
    const detail = {
      eventId: item.event_id,
      coordinates: (item as any).coordinates || ((item as any).latitude && (item as any).longitude ? [(item as any).longitude, (item as any).latitude] : undefined),
      peakFrp: item.peak_frp_mw || 0,
      anomalyTier: item.anomaly_tier || item.severity_tag || "NORMAL",
    };
    window.dispatchEvent(new CustomEvent("thermo-fly-to-event", { detail }));
    window.dispatchEvent(new CustomEvent("thermo-open-event-drawer", { detail: { eventId: item.event_id } }));
    const url = new URL(window.location.href);
    url.searchParams.delete("focus_lat");
    url.searchParams.delete("focus_lon");
    url.searchParams.delete("facility_id");
    url.searchParams.delete("facility_name");
    url.searchParams.set("eventId", item.event_id);
    window.history.pushState({}, "", url.toString());
  };

  const loadNews = async () => {
    try {
      setLoading(true);
      const [newsRes, firmsRes] = await Promise.all([
        fetch("/api/v1/news", { cache: "no-store" }),
        fetch("/api/v1/firms/status", { cache: "no-store" }).catch(() => null)
      ]);
      if (!newsRes.ok) throw new Error("Failed to fetch news feed");
      const data = await newsRes.json();
      setItems(normalizeNews(data));

      if (firmsRes && firmsRes.ok) {
        const fData = await firmsRes.json();
        if (fData?.last_successful_firms_fetch_utc) {
          setLastPolledAt(fData.last_successful_firms_fetch_utc);
        }
        if (typeof fData?.records_inserted === "number") {
          setRecordsPulled(fData.records_inserted);
        }
      }
    } catch (err) {
      console.error("NewsPanel fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadNews();
    const timer = setInterval(() => {
      fetch("/api/v1/firms/status", { cache: "no-store" })
        .then((r) => r.json())
        .then((fData) => {
          if (fData?.last_successful_firms_fetch_utc) {
            setLastPolledAt(fData.last_successful_firms_fetch_utc);
          }
          if (typeof fData?.records_inserted === "number") {
            setRecordsPulled(fData.records_inserted);
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let alive = true;
    let fallbackTimer: number | undefined;
    const source = new EventSource("/api/v1/stream/news");

    const clearFallback = () => {
      if (fallbackTimer) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = undefined;
      }
    };

    source.onopen = () => {
      if (!alive) return;
      clearFallback();
      setIsStreaming(true);
    };

    source.onmessage = (event) => {
      if (!alive) return;
      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload?.type === "NEWS_PUBLISHED") {
          setItems((current) => {
            const existingIndex = current.findIndex((item) => item.event_id === payload.event_id);
            if (existingIndex >= 0) {
              const updated = [...current];
              updated[existingIndex] = {
                ...updated[existingIndex],
                id: payload.news_id || updated[existingIndex].id,
                headline: payload.headline || updated[existingIndex].headline,
                summary: payload.summary || updated[existingIndex].summary,
                published_at: new Date().toISOString(),
              };
              return updated;
            }

            return [
              {
                id: payload.news_id || payload.event_id,
                event_id: payload.event_id,
                headline: payload.headline || "Thermo News Update",
                summary: payload.summary || "New thermal intelligence bulletin received.",
                severity_tag: payload.severity || "ALERT",
                anomaly_tier: payload.severity || "ALERT",
                classification: payload.classification || "IND_FLARE",
                location_name: payload.location_name || "India",
                peak_frp_mw: payload.peak_frp_mw || 0,
                confidence_pct: payload.confidence_pct || 0,
                published_at: new Date().toISOString(),
              },
              ...current,
            ].slice(0, 25);
          });
        }
      } catch (err) {
        console.error("Failed to process generic SSE payload:", err);
      }
    };

    source.addEventListener("NEWS_PUBLISHED", (event) => {
      if (!alive) return;
      try {
        const payload = JSON.parse((event as MessageEvent).data || "{}");
        if (!payload?.event_id) return;

        setItems((current) => {
          const existingIndex = current.findIndex((item) => item.event_id === payload.event_id);
          if (existingIndex >= 0) {
            const updated = [...current];
            updated[existingIndex] = {
              ...updated[existingIndex],
              id: payload.news_id || updated[existingIndex].id,
              headline: payload.headline || updated[existingIndex].headline,
              summary: payload.summary || updated[existingIndex].summary,
              published_at: new Date().toISOString(),
            };
            return updated;
          }

          return [
            {
              id: payload.news_id || payload.event_id,
              event_id: payload.event_id,
              headline: payload.headline || "Thermo News Update",
              summary: payload.summary || "New thermal intelligence bulletin received.",
              severity_tag: payload.severity || "ALERT",
              anomaly_tier: payload.severity || "ALERT",
              classification: payload.classification || "IND_FLARE",
              location_name: payload.location_name || "India",
              peak_frp_mw: payload.peak_frp_mw || 0,
              confidence_pct: payload.confidence_pct || 0,
              published_at: new Date().toISOString(),
            },
            ...current,
          ].slice(0, 25);
        });
      } catch (err) {
        console.error("Failed to process SSE news payload:", err);
      }
    });

    source.onerror = () => {
      if (!alive) return;
      setIsStreaming(false);
      source.close();
      void loadNews();
      fallbackTimer = window.setInterval(() => {
        if (!alive) return;
        void loadNews();
      }, 20000);
    };

    return () => {
      alive = false;
      clearFallback();
      source.close();
    };
  }, [open]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const headline = item.headline?.toLowerCase() || "";
      const summary = item.summary?.toLowerCase() || "";
      const location = item.location_name?.toLowerCase() || "";
      const text = `${headline} ${summary} ${location}`;
      if (!text.includes(searchQuery.toLowerCase())) return false;

      if (filterType === "ALL") return true;
      if (filterType === "CRITICAL") {
        return item.anomaly_tier === "CRITICAL" || item.severity_tag === "CRITICAL" || item.classification === "IND_FIRE";
      }
      if (filterType === "ABNORMAL") {
        return item.anomaly_tier === "ABNORMAL" || item.anomaly_tier === "ELEVATED" || item.severity_tag === "ABNORMAL" || item.severity_tag === "ALERT";
      }
      if (filterType === "AGRI") {
        return item.classification === "AGRI_BURN" || item.severity_tag === "AGRI";
      }
      if (filterType === "INDUSTRIAL") {
        return item.classification?.startsWith("IND_") || item.severity_tag === "ROUTINE";
      }
      return true;
    });
  }, [items, searchQuery, filterType]);

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-[460px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col text-slate-700">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 bg-slate-50/75 backdrop-blur-sm">
        <div className="flex items-center text-slate-900 font-bold text-base tracking-tight">
          <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg mr-3">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span>Thermo News Feed</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-mono font-bold tracking-tight">5M SYNC</span>
            </div>
            <div className="text-[11px] font-normal text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-700">
                {recordsPulled !== null ? (
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                    Pulled {recordsPulled} records
                  </span>
                ) : (
                  "NASA FIRMS Telemetry"
                )}
              </span>
              <span>·</span>
              <span className="font-mono text-slate-600 font-medium">
                {lastPolledAt ? `Polled ${formatRelativeTime(lastPolledAt)}` : "5m Polling"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => void loadNews()}
            title="Refresh feed"
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close news panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 5-Minute NASA FIRMS Automated Polling Status Bar */}
      <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-b border-orange-100 px-6 py-2 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-orange-600 animate-pulse shrink-0" />
          <span className="text-slate-600 font-medium">Auto-Sync (every 5m):</span>
          <span className="font-bold text-orange-800 font-mono">
            {recordsPulled !== null ? `${recordsPulled} records pulled` : "Active"}
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          {lastPolledAt ? formatRelativeTime(lastPolledAt) : "Running"}
        </span>
      </div>

      <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by district, state, or plant name..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          {[
            ["ALL", "All Bulletins"],
            ["CRITICAL", "Critical Fires"],
            ["ABNORMAL", "Elevated Anomalies"],
            ["INDUSTRIAL", "Industrial"],
            ["AGRI", "Crop Burns"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilterType(value)}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === value
                  ? value === "CRITICAL"
                    ? "bg-red-600 text-white shadow-sm"
                    : value === "ABNORMAL"
                      ? "bg-amber-600 text-white shadow-sm"
                      : value === "INDUSTRIAL"
                        ? "bg-blue-600 text-white shadow-sm"
                        : value === "AGRI"
                          ? "bg-yellow-600 text-white shadow-sm"
                          : "bg-slate-900 text-white shadow-sm"
                  : value === "CRITICAL"
                    ? "bg-red-50 text-red-700 hover:bg-red-100"
                    : value === "ABNORMAL"
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : value === "INDUSTRIAL"
                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : value === "AGRI"
                          ? "bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label} ({value === "ALL" ? items.length : items.filter((item) => {
                if (value === "CRITICAL") return item.anomaly_tier === "CRITICAL" || item.severity_tag === "CRITICAL" || item.classification === "IND_FIRE";
                if (value === "ABNORMAL") return item.anomaly_tier === "ABNORMAL" || item.anomaly_tier === "ELEVATED" || item.severity_tag === "ABNORMAL" || item.severity_tag === "ALERT";
                if (value === "AGRI") return item.classification === "AGRI_BURN" || item.severity_tag === "AGRI";
                if (value === "INDUSTRIAL") return item.classification?.startsWith("IND_") || item.severity_tag === "ROUTINE";
                return true;
              }).length})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-4"></div>
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-4"></div>
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-4"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center text-slate-500 py-16 text-xs">
            <div className="p-3 bg-slate-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Filter className="w-5 h-5" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">No matching bulletins found</p>
            <p className="text-slate-400">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelectNewsEvent(item)}
              className="p-4 bg-white hover:bg-slate-50/90 border border-slate-200 hover:border-orange-500/40 rounded-xl cursor-pointer transition shadow-sm hover:shadow-md space-y-2.5 group relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-md font-semibold tracking-wider ${
                      item.anomaly_tier === "CRITICAL"
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : item.anomaly_tier === "ABNORMAL"
                          ? "bg-orange-100 text-orange-700 border border-orange-200"
                          : item.anomaly_tier === "ELEVATED"
                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                            : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {item.anomaly_tier || item.severity_tag || "NORMAL"}
                  </span>
                  <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono font-medium">
                    {item.classification || "THERMAL"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{formatTime(item.published_at)}</span>
              </div>

              <h4 className="text-xs font-bold text-slate-900 group-hover:text-orange-600 transition leading-snug">
                {item.headline}
              </h4>

              <p className="text-xs text-slate-600 leading-relaxed">{item.summary}</p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                <div className="flex items-center gap-1 text-slate-700 font-medium truncate max-w-[240px]">
                  <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span className="truncate">{item.location_name || "India"}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-semibold text-slate-900">{item.peak_frp_mw?.toFixed(1) || "0.0"} MW</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-orange-600 font-medium">{item.confidence_pct || 0}% Conf</span>
                </div>
              </div>

              <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition text-orange-600">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 bg-white text-[11px] text-slate-500 shrink-0 flex items-center justify-between">
        <span>{isStreaming ? "Live stream online" : "Polling fallback"}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
          <span className={`h-2 w-2 rounded-full ${isStreaming ? "bg-emerald-500" : "bg-slate-400"}`} />
          {isStreaming ? "Connected" : "Reconnect"}
        </span>
      </div>
    </div>
  );
}
