"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  Flame, Building2, FileText, LayoutDashboard, Bell, 
  Newspaper, BookOpen, BarChart2, PieChart, Radio, Sparkles, User,
  ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchNotifications } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Monitor", href: "/monitor" },
  { icon: Building2, label: "Facilities", href: "/facilities" },
  { icon: FileText, label: "Reports", href: "/reports" },
  { icon: BarChart2, label: "National Analytics", href: "/analytics" },
];

function FlamePlusIcon({ active = false }: { active?: boolean }) {
  return (
    <span className="relative inline-flex items-center justify-center w-5 h-5 shrink-0">
      <Flame className={cn("w-5 h-5", active ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
      <span className="absolute -top-1 -right-1 flex items-center justify-center w-3 h-3 rounded-full bg-orange-600 text-white font-black text-[8px] leading-none shadow-sm ring-1 ring-white">
        +
      </span>
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentOverlay = searchParams.get("overlay");
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Read saved collapse state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("thermo_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch (e) {}
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const nextState = !prev;
      try {
        localStorage.setItem("thermo_sidebar_collapsed", String(nextState));
      } catch (e) {}
      return nextState;
    });
  };

  useEffect(() => {
    fetchNotifications()
      .then((notifs) => {
        if (Array.isArray(notifs)) {
          setUnreadAlerts(notifs.filter((n: any) => !n.is_read).length);
        }
      })
      .catch(() => {});
  }, [currentOverlay]);

  const toggleOverlay = (overlayName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentOverlay === overlayName) {
      params.delete("overlay");
    } else {
      params.set("overlay", overlayName);
    }
    const newQuery = params.toString();
    router.push(`${pathname}${newQuery ? "?" + newQuery : ""}`);
  };

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col border-r border-slate-200 bg-white text-slate-600 z-50 shadow-sm relative shrink-0 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-20 lg:w-64"
      )}
    >
      {/* Sidebar Header & Collapse Toggle Button */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 shrink-0">
        <Link 
          href="/" 
          title="Return to ThermoTrace AI Landing Page" 
          className="flex items-center justify-center lg:justify-start hover:opacity-90 transition-opacity cursor-pointer group"
        >
          <Flame className="w-8 h-8 text-orange-600 group-hover:scale-105 transition-transform shrink-0" />
          {!isCollapsed && (
            <span className="hidden lg:block ml-3 font-bold text-lg text-slate-900 tracking-tight group-hover:text-orange-600 transition-colors truncate">
              ThermoTrace AI
            </span>
          )}
        </Link>
        
        <button
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand Navigation Sidebar" : "Collapse Navigation Sidebar"}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-slate-600" />
          ) : (
            <PanelLeftClose className="w-5 h-5 text-slate-500 hidden lg:block" />
          )}
        </button>
      </div>
      
      <nav className="flex-1 py-3 flex flex-col gap-1 px-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {!isCollapsed && (
          <div className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider hidden lg:block px-3">
            Main
          </div>
        )}
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center py-2 px-3 rounded-lg transition-colors group",
                isCollapsed ? "justify-center" : "justify-start",
                isActive 
                  ? "bg-slate-100 text-orange-600 font-medium" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
              {!isCollapsed && <span className="hidden lg:block ml-3 truncate">{item.label}</span>}
            </Link>
          );
        })}

        {!isCollapsed && (
          <div className="text-xs font-semibold text-slate-400 mt-5 mb-1.5 uppercase tracking-wider hidden lg:block px-3">
            Intelligence
          </div>
        )}
        
        {/* Thermo News with NRT Live Reminder Indicator */}
        <button 
          onClick={() => toggleOverlay("news")}
          className={cn(
            "flex items-center justify-between py-2 px-3 rounded-lg transition-colors group w-full text-left relative", 
            isCollapsed ? "justify-center" : "",
            currentOverlay === "news" ? "bg-slate-100 text-orange-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
          title="Live 24h NASA FIRMS Thermal News Feed"
        >
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "")}>
            <Newspaper className={cn("w-5 h-5 shrink-0", currentOverlay === "news" ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
            {!isCollapsed && <span className="hidden lg:block ml-3 truncate">Thermo News</span>}
          </div>
          {!isCollapsed && (
            <span className="hidden lg:flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-ping" />
              LIVE NRT
            </span>
          )}
        </button>

        {/* Operational Alerts with Unread Badge */}
        <button 
          onClick={() => toggleOverlay("alerts")}
          className={cn(
            "flex items-center justify-between py-2 px-3 rounded-lg transition-colors group w-full text-left relative", 
            isCollapsed ? "justify-center" : "",
            currentOverlay === "alerts" ? "bg-slate-100 text-orange-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
          title="Critical, Abnormal & Industrial Operational Alerts"
        >
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "")}>
            <Bell className={cn("w-5 h-5 shrink-0", currentOverlay === "alerts" ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
            {!isCollapsed && <span className="hidden lg:block ml-3 truncate">Alerts</span>}
          </div>
          {unreadAlerts > 0 && (
            <span className={cn(
              "flex items-center justify-center bg-red-600 text-white rounded-full text-[10px] font-bold shrink-0",
              isCollapsed ? "absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px]" : "hidden lg:flex px-1.5 py-0.2"
            )}>
              {unreadAlerts}
            </span>
          )}
        </button>

        {/* Chat Interface */}
        <button 
          onClick={() => toggleOverlay("chat")}
          className={cn(
            "flex items-center py-2 px-3 rounded-lg transition-colors group w-full text-left", 
            isCollapsed ? "justify-center" : "",
            currentOverlay === "chat" ? "bg-slate-100 text-orange-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
          title="Thermo AI Chat Assistant"
        >
          <FlamePlusIcon active={currentOverlay === "chat"} />
          {!isCollapsed && <span className="hidden lg:block ml-3 truncate">Chat Interface</span>}
        </button>

        {!isCollapsed && (
          <div className="text-xs font-semibold text-slate-400 mt-5 mb-1.5 uppercase tracking-wider hidden lg:block px-3">
            System & Guide
          </div>
        )}

        {/* System Guide & Architecture Manual (Dedicated Full Page) */}
        <Link
          href="/guide"
          title="Authoritative Engineering Architecture, Algorithms & System Guide"
          className={cn(
            "flex items-center py-2 px-3 rounded-lg transition-colors group w-full text-left",
            isCollapsed ? "justify-center" : "",
            pathname === "/guide"
              ? "bg-slate-100 text-orange-600 font-semibold"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <BookOpen className={cn("w-5 h-5 shrink-0", pathname === "/guide" ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
          {!isCollapsed && <span className="hidden lg:block ml-3 truncate">System Guide & Info</span>}
        </Link>
      </nav>
      
      <div className="p-4 border-t border-slate-200 text-center lg:text-left shrink-0">
        <button 
          onClick={() => toggleOverlay("settings")}
          className={cn(
            "flex items-center w-full p-2 rounded transition-colors justify-center", 
            !isCollapsed ? "lg:justify-start" : "",
            currentOverlay === "settings" ? "bg-slate-100" : "hover:bg-slate-50"
          )}
          title="User Profile & Settings"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-700 border border-slate-200 shrink-0">
            <User className="w-4 h-4 text-slate-600" />
          </div>
          {!isCollapsed && (
            <div className="hidden lg:block ml-3 text-left truncate">
              <div className="text-sm font-medium text-slate-900 truncate">User Profile</div>
              <div className="text-xs text-slate-500 truncate">Settings</div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
