"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { 
  X, Newspaper, Bell, MessageSquare, Settings, Flame, 
  AlertTriangle, ShieldCheck, Activity, Satellite, CheckCircle2, 
  MapPin, ArrowUpRight, Search, Filter, RefreshCw, Sun, Moon
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchNews, fetchFirmsStatus } from "@/lib/apiClient";

export function OverlayManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const overlay = searchParams.get("overlay");
  
  const [mounted, setMounted] = useState(false);
  const [news, setNews] = useState<any[]>([]);
  const [firmsStatus, setFirmsStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [theme, setTheme] = useState<string>("light");

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("thermo_theme") || "light";
    setTheme(savedTheme);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("thermo_theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const loadData = () => {
    if (!overlay) return;
    setLoading(true);

    if (overlay === "news" || overlay === "alerts") {
      fetchNews()
        .then(data => setNews(data))
        .catch(err => console.error("Error fetching news:", err))
        .finally(() => setLoading(false));
    } else if (overlay === "settings") {
      fetchFirmsStatus()
        .then(data => setFirmsStatus(data))
        .catch(err => console.error("Error fetching FIRMS status:", err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [overlay]);

  if (!mounted || !overlay) return null;

  const closeOverlay = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("overlay");
    const newQuery = params.toString();
    router.push(`${pathname}${newQuery ? "?" + newQuery : ""}`);
  };

  const handleSelectEvent = (eventId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("overlay");
    params.set("eventId", eventId);
    router.push(`/monitor?${params.toString()}`);
  };

  const filteredNews = news.filter(item => {
    const matchesSearch = 
      item.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location_name.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (!matchesSearch) return false;
    if (filterType === "ALL") return true;
    if (filterType === "CRITICAL") return item.anomaly_tier === "CRITICAL" || item.severity_tag === "CRITICAL" || item.classification === "IND_FIRE";
    if (filterType === "ABNORMAL") return item.anomaly_tier === "ABNORMAL" || item.anomaly_tier === "ELEVATED" || item.severity_tag === "ABNORMAL" || item.severity_tag === "ALERT";
    if (filterType === "AGRI") return item.classification === "AGRI_BURN" || item.severity_tag === "AGRI";
    if (filterType === "INDUSTRIAL") return item.classification.startsWith("IND_") || item.severity_tag === "ROUTINE";
    return true;
  });

  return (
    <div className="fixed top-0 right-0 h-full w-[460px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 text-slate-700">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 bg-slate-50/75 backdrop-blur-sm">
        <div className="flex items-center text-slate-900 font-bold text-base tracking-tight">
          {overlay === "news" && (
            <>
              <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg mr-3">
                <Newspaper className="w-5 h-5" />
              </div>
              <div>
                <div>Thermo News Feed</div>
                <div className="text-[11px] font-normal text-slate-500">Live Indian Thermal Intelligence</div>
              </div>
            </>
          )}
          {overlay === "alerts" && (
            <>
              <div className="p-1.5 bg-red-100 text-red-600 rounded-lg mr-3">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div>Operational Alerts</div>
                <div className="text-[11px] font-normal text-slate-500">Priority Anomaly Bulletins</div>
              </div>
            </>
          )}
          {overlay === "chat" && (
            <>
              <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg mr-3">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <div>Tactical AI Query</div>
                <div className="text-[11px] font-normal text-slate-500">PostGIS Grounded Assistant</div>
              </div>
            </>
          )}
          {overlay === "settings" && (
            <>
              <div className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg mr-3">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div>System & Telemetry Settings</div>
                <div className="text-[11px] font-normal text-slate-500">Appearance & NASA FIRMS Cadence</div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={loadData} 
            title="Refresh Feed"
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-600' : ''}`} />
          </button>
          <button 
            onClick={closeOverlay} 
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Subheader / Filters for News */}
      {(overlay === "news" || overlay === "alerts") && (
        <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by district, state, or plant name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <button 
              onClick={() => setFilterType("ALL")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "ALL" 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Bulletins ({news.length})
            </button>
            <button 
              onClick={() => setFilterType("CRITICAL")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "CRITICAL" 
                  ? "bg-red-600 text-white shadow-sm" 
                  : "bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              Critical Fires
            </button>
            <button 
              onClick={() => setFilterType("ABNORMAL")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "ABNORMAL" 
                  ? "bg-amber-600 text-white shadow-sm" 
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              Elevated Anomalies
            </button>
            <button 
              onClick={() => setFilterType("INDUSTRIAL")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "INDUSTRIAL" 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              Industrial
            </button>
            <button 
              onClick={() => setFilterType("AGRI")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "AGRI" 
                  ? "bg-yellow-600 text-white shadow-sm" 
                  : "bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
              }`}
            >
              Crop Burns
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-4"></div>
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-4"></div>
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-4"></div>
          </div>
        ) : overlay === "news" || overlay === "alerts" ? (
          filteredNews.length === 0 ? (
            <div className="text-center text-slate-500 py-16 text-xs">
              <div className="p-3 bg-slate-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Filter className="w-5 h-5" />
              </div>
              <p className="font-semibold text-slate-700 mb-1">No matching bulletins found</p>
              <p className="text-slate-400">Try adjusting your filters or search keywords.</p>
            </div>
          ) : (
            filteredNews.map((item) => (
              <div 
                key={item.id}
                onClick={() => handleSelectEvent(item.event_id)}
                className="p-4 bg-white hover:bg-slate-50/90 border border-slate-200 hover:border-orange-500/40 rounded-xl cursor-pointer transition shadow-sm hover:shadow-md space-y-2.5 group relative"
              >
                {/* Top Badge & Time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-semibold tracking-wider ${
                      item.anomaly_tier === "CRITICAL" ? "bg-red-100 text-red-700 border border-red-200" :
                      item.anomaly_tier === "ABNORMAL" ? "bg-orange-100 text-orange-700 border border-orange-200" :
                      item.anomaly_tier === "ELEVATED" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                      "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}>
                      {item.anomaly_tier}
                    </span>
                    <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono font-medium">
                      {item.classification}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Headline */}
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-orange-600 transition leading-snug">
                  {item.headline}
                </h4>

                {/* Summary */}
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.summary}
                </p>

                {/* Location & Metrics Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                  <div className="flex items-center gap-1 text-slate-700 font-medium truncate max-w-[240px]">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="truncate">{item.location_name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-semibold text-slate-900">{item.peak_frp_mw?.toFixed(1)} MW</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-orange-600 font-medium">{item.confidence_pct}% Conf</span>
                  </div>
                </div>

                {/* Hover CTA Indicator */}
                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition text-orange-600">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            ))
          )
        ) : overlay === "settings" ? (
          <div className="space-y-4 text-xs">
            {/* Visual Appearance & Theme Selector */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="font-bold text-slate-900 text-sm">Visual Appearance</div>
              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  onClick={() => handleThemeChange("light")}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${
                    theme === "light" 
                      ? "border-orange-500 bg-orange-50/40 text-orange-700 font-bold" 
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Sun className="w-5 h-5 text-orange-500" />
                  <span className="text-xs">Clean Light (Default)</span>
                </button>
                <button 
                  onClick={() => handleThemeChange("dark")}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${
                    theme === "dark" 
                      ? "border-orange-500 bg-orange-50/40 text-orange-700 font-bold" 
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Moon className="w-5 h-5 text-slate-700" />
                  <span className="text-xs">Dark Aerospace</span>
                </button>
              </div>
            </div>

            {/* NASA FIRMS Telemetry Status */}
            {firmsStatus ? (
              <>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                    <span>NASA FIRMS Ingestion</span>
                    <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold text-xs border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {firmsStatus.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Freshness Status:</span>
                    <span className="text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded font-mono font-semibold border border-cyan-200">
                      {firmsStatus.data_freshness_status}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Autonomous Polling:</span>
                    <span className="text-slate-900 font-semibold font-mono">Every 5 Minutes</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Geographic Extent:</span>
                    <span className="text-slate-800 font-mono font-medium">India [68°E–97°E, 6°N–37°N]</span>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <div className="text-slate-900 font-semibold mb-1">Active Satellites & NRT Feeds</div>
                  <div className="flex flex-wrap gap-1.5">
                    {firmsStatus.active_sensors.map((s: string) => (
                      <span key={s} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-mono text-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 font-mono text-[11px]">
                  <div className="text-slate-900 font-sans font-semibold mb-1">Telemetry Metrics</div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Last Fetch UTC:</span>
                    <span className="text-slate-900 font-medium">{firmsStatus.last_successful_firms_fetch_utc ? new Date(firmsStatus.last_successful_firms_fetch_utc).toUTCString() : "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Latest Satellite Obs:</span>
                    <span className="text-slate-900 font-medium">{firmsStatus.latest_observation_timestamp_utc ? new Date(firmsStatus.latest_observation_timestamp_utc).toUTCString() : "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Observations Ingested:</span>
                    <span className="text-emerald-600 font-bold">{firmsStatus.records_inserted} new / {firmsStatus.records_received} total</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-500 py-12 text-xs">FIRMS status unavailable.</div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center py-16 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <MessageSquare className="w-10 h-10 text-indigo-500 mb-3" />
            <p className="font-bold text-slate-900 text-sm mb-1">Thermal Intelligence Assistant</p>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              PostGIS-grounded local AI is active. Click any thermal event on the map or select a bulletin from the News Feed to review its detailed tactical brief.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
