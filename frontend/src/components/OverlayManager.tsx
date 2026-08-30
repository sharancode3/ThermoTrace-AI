"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { 
  X, Newspaper, Bell, Settings, Flame, Plus,
  AlertTriangle, ShieldCheck, Activity, Satellite, CheckCircle2, 
  MapPin, ArrowUpRight, Search, Filter, RefreshCw, Sun, Moon,
  Send, LoaderCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { askThermalChat, fetchNews, fetchFirmsStatus } from "@/lib/apiClient";

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
  const [theme, setTheme] = useState<string>("dark");
  const [chatDraft, setChatDraft] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>(`sess_${Date.now()}`);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string; events?: Array<any> }>>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ask about abnormal thermal events, flaring clusters, or industrial facilities across India. I evaluate verified real-time satellite telemetry from PostGIS and answer with zero hallucinations.",
    },
  ]);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("thermo_theme") || "dark";
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

  const quickPrompts = useMemo(() => [
    "Show abnormal industrial flares in Gujarat",
    "List critical anomalies in Maharashtra",
    "Which events are currently elevated?"
  ], []);

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

  const handleChatSubmit = async () => {
    const trimmed = chatDraft.trim();
    if (!trimmed || chatLoading) return;

    const userMessage = { id: `user-${Date.now()}`, role: "user" as const, content: trimmed };
    setChatMessages((current) => [...current, userMessage]);
    setChatDraft("");
    setChatLoading(true);

    try {
      const response = await askThermalChat(trimmed, sessionId);
      const payload = response?.data ?? {};
      const answer = payload.answer_markdown || "No answer available.";
      const groundedEvents = Array.isArray(payload.grounded_events) ? payload.grounded_events : [];

      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: answer,
          events: groundedEvents,
        },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: "I could not retrieve the event dataset right now. Please verify backend connectivity.",
          events: [],
        },
      ]);
      console.error("Chat query failed:", error);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="fixed top-0 right-0 h-full w-[480px] bg-[#0B0F17]/95 backdrop-blur-xl border-l border-slate-800/90 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 text-slate-200">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80 shrink-0 bg-[#0F172A]/80 backdrop-blur-md">
        <div className="flex items-center text-white font-bold text-base tracking-tight">
          {overlay === "news" && (
            <>
              <div className="p-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg mr-3 shadow-inner">
                <Newspaper className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide">Thermo News Feed</div>
                <div className="text-[11px] font-mono text-slate-400">Live Indian Thermal Intelligence</div>
              </div>
            </>
          )}
          {overlay === "alerts" && (
            <>
              <div className="p-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg mr-3 shadow-inner">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide">Operational Alerts</div>
                <div className="text-[11px] font-mono text-slate-400">Priority Anomaly Bulletins</div>
              </div>
            </>
          )}
          {overlay === "chat" && (
            <>
              <div className="p-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg mr-3 shadow-inner relative flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
                <Plus className="w-2.5 h-2.5 text-orange-400 absolute -top-0.5 -right-0.5 stroke-[3]" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide">Tactical AI Query</div>
                <div className="text-[11px] font-mono text-cyan-400">PostGIS Grounded Assistant</div>
              </div>
            </>
          )}
          {overlay === "settings" && (
            <>
              <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg mr-3 shadow-inner">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide">System & Telemetry Settings</div>
                <div className="text-[11px] font-mono text-slate-400">Appearance & NASA FIRMS Cadence</div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={loadData} 
            title="Refresh Feed"
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800/60 transition border border-transparent hover:border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
          <button 
            onClick={closeOverlay} 
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800/60 transition border border-transparent hover:border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Subheader / Filters for News */}
      {(overlay === "news" || overlay === "alerts") && (
        <div className="p-4 border-b border-slate-800/80 bg-[#0F172A]/40 space-y-3 shrink-0">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by district, state, or plant name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0B0F17] border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <button 
              onClick={() => setFilterType("ALL")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "ALL" 
                  ? "bg-orange-600 text-white shadow-sm font-semibold" 
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              All Bulletins ({news.length})
            </button>
            <button 
              onClick={() => setFilterType("CRITICAL")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "CRITICAL" 
                  ? "bg-red-600 text-white shadow-sm font-semibold" 
                  : "bg-red-950/40 text-red-300 hover:bg-red-900/50 border border-red-800/60"
              }`}
            >
              Critical Fires
            </button>
            <button 
              onClick={() => setFilterType("ABNORMAL")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "ABNORMAL" 
                  ? "bg-amber-600 text-white shadow-sm font-semibold" 
                  : "bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 border border-amber-800/60"
              }`}
            >
              Elevated Anomalies
            </button>
            <button 
              onClick={() => setFilterType("INDUSTRIAL")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "INDUSTRIAL" 
                  ? "bg-cyan-600 text-white shadow-sm font-semibold" 
                  : "bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50 border border-cyan-800/60"
              }`}
            >
              Industrial
            </button>
            <button 
              onClick={() => setFilterType("AGRI")}
              className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                filterType === "AGRI" 
                  ? "bg-yellow-600 text-white shadow-sm font-semibold" 
                  : "bg-yellow-950/40 text-yellow-300 hover:bg-yellow-900/50 border border-yellow-800/60"
              }`}
            >
              Crop Burns
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0B0F17]/40">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-28 bg-[#131B2B] border border-slate-800 rounded-xl p-4"></div>
            <div className="h-28 bg-[#131B2B] border border-slate-800 rounded-xl p-4"></div>
            <div className="h-28 bg-[#131B2B] border border-slate-800 rounded-xl p-4"></div>
          </div>
        ) : overlay === "news" || overlay === "alerts" ? (
          filteredNews.length === 0 ? (
            <div className="text-center text-slate-400 py-16 text-xs">
              <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Filter className="w-5 h-5" />
              </div>
              <p className="font-semibold text-slate-200 mb-1">No matching bulletins found</p>
              <p className="text-slate-500">Try adjusting your filters or search keywords.</p>
            </div>
          ) : (
            filteredNews.map((item) => (
              <div 
                key={item.id}
                onClick={() => handleSelectEvent(item.event_id)}
                className="p-4 bg-[#131B2B]/90 hover:bg-[#1A2337] border border-slate-800 hover:border-orange-500/50 rounded-xl cursor-pointer transition shadow-lg space-y-2.5 group relative"
              >
                {/* Top Badge & Time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-semibold tracking-wider ${
                      item.anomaly_tier === "CRITICAL" ? "bg-red-950/80 text-red-400 border border-red-800/80" :
                      item.anomaly_tier === "ABNORMAL" ? "bg-orange-950/80 text-orange-400 border border-orange-800/80" :
                      item.anomaly_tier === "ELEVATED" ? "bg-amber-950/80 text-amber-400 border border-amber-800/80" :
                      "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                    }`}>
                      {item.anomaly_tier}
                    </span>
                    <span className="text-[10px] text-slate-300 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded font-mono font-medium">
                      {item.classification}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Headline */}
                <h4 className="text-xs font-bold text-white group-hover:text-orange-400 transition leading-snug">
                  {item.headline}
                </h4>

                {/* Summary */}
                <p className="text-xs text-slate-300 leading-relaxed">
                  {item.summary}
                </p>

                {/* Location & Metrics Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <div className="flex items-center gap-1 text-slate-300 font-medium truncate max-w-[240px]">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="truncate">{item.location_name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-semibold text-white">{item.peak_frp_mw?.toFixed(1)} MW</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-orange-400 font-medium">{item.confidence_pct}% Conf</span>
                  </div>
                </div>

                {/* Hover CTA Indicator */}
                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition text-orange-400">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            ))
          )
        ) : overlay === "settings" ? (
          <div className="space-y-4 text-xs">
            {/* Visual Appearance & Theme Selector */}
            <div className="p-4 bg-[#131B2B] rounded-xl border border-slate-800 shadow-sm space-y-3">
              <div className="font-bold text-white text-sm">Visual Appearance</div>
              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  onClick={() => handleThemeChange("dark")}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${
                    theme === "dark" 
                      ? "border-orange-500 bg-orange-950/30 text-orange-400 font-bold" 
                      : "border-slate-800 bg-[#0B0F17] text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <Moon className="w-5 h-5 text-orange-400" />
                  <span className="text-xs">Dark Aerospace (Default)</span>
                </button>
                <button 
                  onClick={() => handleThemeChange("light")}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${
                    theme === "light" 
                      ? "border-orange-500 bg-orange-950/30 text-orange-400 font-bold" 
                      : "border-slate-800 bg-[#0B0F17] text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <Sun className="w-5 h-5 text-slate-400" />
                  <span className="text-xs">Daylight High Contrast</span>
                </button>
              </div>
            </div>

            {/* NASA FIRMS Telemetry Status */}
            {firmsStatus ? (
              <>
                <div className="p-4 bg-[#131B2B] rounded-xl border border-slate-800 shadow-sm space-y-3">
                  <div className="font-bold text-white text-sm flex items-center justify-between">
                    <span>NASA FIRMS Ingestion</span>
                    <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md font-semibold text-xs border border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {firmsStatus.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Freshness Status:</span>
                    <span className="text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded font-mono font-semibold border border-cyan-800">
                      {firmsStatus.data_freshness_status}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Autonomous Polling:</span>
                    <span className="text-white font-semibold font-mono">Every 5 Minutes</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Geographic Extent:</span>
                    <span className="text-slate-200 font-mono font-medium">India [68°E–97°E, 6°N–37°N]</span>
                  </div>
                </div>

                <div className="p-4 bg-[#131B2B] rounded-xl border border-slate-800 shadow-sm space-y-2">
                  <div className="text-white font-semibold mb-1">Active Satellites & NRT Feeds</div>
                  <div className="flex flex-wrap gap-1.5">
                    {firmsStatus.active_sensors.map((s: string) => (
                      <span key={s} className="px-2.5 py-1 bg-[#0B0F17] border border-slate-800 rounded-md text-[11px] font-mono text-slate-300">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-[#131B2B] rounded-xl border border-slate-800 shadow-sm space-y-2 font-mono text-[11px]">
                  <div className="text-white font-sans font-semibold mb-1">Telemetry Metrics</div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Last Fetch UTC:</span>
                    <span className="text-white font-medium">{firmsStatus.last_successful_firms_fetch_utc ? new Date(firmsStatus.last_successful_firms_fetch_utc).toUTCString() : "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Latest Satellite Obs:</span>
                    <span className="text-white font-medium">{firmsStatus.latest_observation_timestamp_utc ? new Date(firmsStatus.latest_observation_timestamp_utc).toUTCString() : "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Observations Ingested:</span>
                    <span className="text-emerald-400 font-bold">{firmsStatus.records_inserted} new / {firmsStatus.records_received} total</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-500 py-12 text-xs">FIRMS status unavailable.</div>
            )}
          </div>
        ) : overlay === "chat" ? (
          <div className="flex-1 flex flex-col bg-[#0B0F17]/50 rounded-xl overflow-hidden border border-slate-800/80">
            {/* Chat Subheader & Quick Prompt Chips */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-800 bg-[#0F172A]/70 backdrop-blur-sm shrink-0">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 text-white font-semibold text-xs tracking-wide">
                  <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 relative flex items-center justify-center">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <Plus className="w-2.5 h-2.5 text-orange-400 absolute -top-0.5 -right-0.5 stroke-[3]" />
                  </div>
                  <span>Grounded Event Analysis</span>
                </div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                  Live PostGIS
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setChatDraft(prompt)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-800 bg-[#131B2B] text-slate-300 hover:border-orange-500/60 hover:text-white transition"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-xl border px-3.5 py-2.5 shadow-md ${
                    message.role === "user"
                      ? "bg-orange-600 text-white border-orange-500"
                      : "bg-[#131B2B] text-slate-200 border-slate-800"
                  }`}>
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-wider text-orange-400 font-semibold font-mono">
                        <div className="relative inline-flex items-center justify-center">
                          <Flame className="w-3.5 h-3.5 text-orange-500" />
                          <Plus className="w-2 h-2 text-orange-400 absolute -top-0.5 -right-0.5 stroke-[3]" />
                        </div>
                        Thermo AI
                      </div>
                    )}

                    <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </p>

                    {message.events && message.events.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.events.map((event: any) => (
                          <button
                            key={`${message.id}-${event.event_id}`}
                            type="button"
                            onClick={() => handleSelectEvent(event.event_id)}
                            className="w-full text-left p-2.5 rounded-lg border border-slate-800 bg-[#0B0F17] hover:border-orange-500/60 hover:bg-[#1A2337] transition"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold font-mono tracking-wider text-cyan-400 uppercase">{event.event_id}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                event.anomaly_tier === "CRITICAL" ? "bg-red-950/80 text-red-400 border border-red-800" :
                                event.anomaly_tier === "ABNORMAL" ? "bg-orange-950/80 text-orange-400 border border-orange-800" :
                                event.anomaly_tier === "ELEVATED" ? "bg-amber-950/80 text-amber-400 border border-amber-800" :
                                "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                              }`}>
                                {event.anomaly_tier || "NORMAL"}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-300 font-medium truncate">{event.facility_name || "Unknown industrial facility"}</div>
                            <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
                              <span className="text-orange-400 font-semibold">{Number(event.peak_frp_mw || 0).toFixed(1)} MW</span>
                              <span>{Number(event.latitude || 0).toFixed(4)}°N, {Number(event.longitude || 0).toFixed(4)}°E</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-xl border border-slate-800 bg-[#131B2B] px-3.5 py-2.5 shadow-md text-slate-300">
                    <div className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-wider text-orange-400 font-semibold mb-2">
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin text-orange-400" />
                      Thermo AI
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                      Scanning PostGIS dataset and preparing tactical answer...
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Box */}
            <div className="p-3 border-t border-slate-800 bg-[#0F172A]/90 shrink-0">
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 py-2 focus-within:border-orange-500 transition">
                <textarea
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleChatSubmit();
                    }
                  }}
                  rows={1}
                  placeholder="Ask about thermal activity in a state or facility..."
                  className="flex-1 resize-none bg-transparent text-xs text-slate-100 placeholder-slate-500 outline-none min-h-[36px] max-h-[120px]"
                />
                <button
                  type="button"
                  onClick={() => void handleChatSubmit()}
                  disabled={chatLoading || !chatDraft.trim()}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-orange-600 text-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition hover:bg-orange-500 shadow-md"
                  aria-label="Send query"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center py-16 bg-[#131B2B] rounded-xl border border-slate-800 p-6 shadow-sm">
            <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 relative flex items-center justify-center mb-3">
              <Flame className="w-8 h-8 text-orange-500" />
              <Plus className="w-4 h-4 text-orange-400 absolute -top-1 -right-1 stroke-[3]" />
            </div>
            <p className="font-bold text-white text-sm mb-1">Thermal Intelligence Assistant</p>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              PostGIS-grounded local AI is active. Click any thermal event on the map or select a bulletin from the News Feed to review its detailed tactical brief.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
