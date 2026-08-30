"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, MapPin, RefreshCw, X } from "lucide-react";

interface NotificationItem {
  id: string;
  event_id: string;
  notification_type?: string;
  severity?: string;
  message?: string;
  is_read?: boolean;
  created_at?: string;
}

function normalizeNotifications(payload: any): NotificationItem[] {
  if (Array.isArray(payload)) return payload as NotificationItem[];
  if (Array.isArray(payload?.notifications)) return payload.notifications as NotificationItem[];
  if (Array.isArray(payload?.data)) return payload.data as NotificationItem[];
  return [];
}

function formatTime(value?: string) {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function NotificationDrawer({
  open = true,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setItems(normalizeNotifications(data));
    } catch (err) {
      console.error("NotificationDrawer fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
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
        if (payload?.type === "NOTIFICATION_CREATED" || payload?.type === "EVENT_SEVERITY_CHANGED") {
          if (payload.type === "NOTIFICATION_CREATED") {
            setItems((current) => {
              const next = [
                {
                  id: payload.notification_id || `${payload.event_id}-notification`,
                  event_id: payload.event_id,
                  notification_type: payload.notification_type || "NOTIFICATION_CREATED",
                  severity: payload.severity || "CRITICAL",
                  message: payload.message || "Alert updated.",
                  is_read: false,
                  created_at: new Date().toISOString(),
                },
                ...current,
              ];
              return next.slice(0, 25);
            });
          }

          if (payload.type === "EVENT_SEVERITY_CHANGED") {
            setItems((current) =>
              current.map((item) =>
                item.event_id === payload.event_id
                  ? {
                      ...item,
                      severity: payload.to_tier || item.severity,
                      message: `Severity changed from ${payload.from_tier || "UNKNOWN"} to ${payload.to_tier || "UNKNOWN"}`,
                    }
                  : item,
              ),
            );
          }
        }
      } catch (err) {
        console.error("Failed to process generic SSE payload:", err);
      }
    };

    source.addEventListener("NOTIFICATION_CREATED", (event) => {
      if (!alive) return;
      try {
        const payload = JSON.parse((event as MessageEvent).data || "{}");
        if (!payload?.notification_id && !payload?.event_id) return;

        setItems((current) => {
          const next = [
            {
              id: payload.notification_id || `${payload.event_id}-notification`,
              event_id: payload.event_id,
              notification_type: payload.notification_type || "NOTIFICATION_CREATED",
              severity: payload.severity || "CRITICAL",
              message: payload.message || "Alert updated.",
              is_read: false,
              created_at: new Date().toISOString(),
            },
            ...current,
          ];
          return next.slice(0, 25);
        });
      } catch (err) {
        console.error("Failed to process SSE notification payload:", err);
      }
    });

    source.addEventListener("EVENT_SEVERITY_CHANGED", (event) => {
      if (!alive) return;
      try {
        const payload = JSON.parse((event as MessageEvent).data || "{}");
        if (!payload?.event_id) return;

        setItems((current) =>
          current.map((item) =>
            item.event_id === payload.event_id
              ? {
                  ...item,
                  severity: payload.to_tier || item.severity,
                  message: `Severity changed from ${payload.from_tier || "UNKNOWN"} to ${payload.to_tier || "UNKNOWN"}`,
                }
              : item,
          ),
        );
      } catch (err) {
        console.error("Failed to process severity event payload:", err);
      }
    });

    source.onerror = () => {
      if (!alive) return;
      setIsStreaming(false);
      source.close();
      void loadNotifications();
      fallbackTimer = window.setInterval(() => {
        if (!alive) return;
        void loadNotifications();
      }, 20000);
    };

    return () => {
      alive = false;
      clearFallback();
      source.close();
    };
  }, [open]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items],
  );

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-[460px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col text-slate-700">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 bg-slate-50/75 backdrop-blur-sm">
        <div className="flex items-center text-slate-900 font-bold text-base tracking-tight">
          <div className="p-1.5 bg-red-100 text-red-600 rounded-lg mr-3">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div>Operational Alerts</div>
            <div className="text-[11px] font-normal text-slate-500">{unreadCount} active notifications</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => void loadNotifications()}
            title="Refresh notifications"
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close notifications"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-600">
            <span className={`h-2 w-2 rounded-full ${isStreaming ? "bg-emerald-500" : "bg-slate-400"}`} />
            {isStreaming ? "Live stream" : "Polling fallback"}
          </span>
          <span className="text-slate-500">Last updated {formatTime(new Date().toISOString())}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {loading && items.length === 0 ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-4"></div>
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-4"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-slate-500 py-16 text-xs">
            <div className="p-3 bg-slate-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Bell className="w-5 h-5" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">No active alerts</p>
            <p className="text-slate-400">Critical events will appear here when detected.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-md font-semibold tracking-wider border ${
                      item.severity === "CRITICAL"
                        ? "bg-red-100 text-red-700 border-red-200"
                        : item.severity === "ABNORMAL"
                          ? "bg-orange-100 text-orange-700 border-orange-200"
                          : item.severity === "ELEVATED"
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-emerald-100 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {item.severity || item.notification_type || "ALERT"}
                  </span>
                  <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono font-medium">
                    {item.notification_type || "NOTIFICATION"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{formatTime(item.created_at)}</span>
              </div>

              <p className="text-xs font-bold text-slate-900 leading-snug">{item.message || "Thermal event alert"}</p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                <div className="flex items-center gap-1 text-slate-700 font-medium truncate max-w-[260px]">
                  <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span className="truncate">Event {item.event_id}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  {!item.is_read && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  <span>{item.is_read ? "Read" : "New"}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
