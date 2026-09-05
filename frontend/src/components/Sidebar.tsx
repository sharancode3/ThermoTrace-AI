"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  Flame, Building2, FileText, LayoutDashboard, Bell, 
  Newspaper, BookOpen, BarChart2, PieChart, Radio, Sparkles, User
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
    <span className="relative inline-flex items-center justify-center w-5 h-5">
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
    <aside className="hidden md:flex flex-col w-20 lg:w-64 border-r border-slate-200 bg-white text-slate-600 z-50 shadow-sm relative shrink-0">
      <Link 
        href="/" 
        title="Return to ThermoTrace AI Landing Page" 
        className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-200 shrink-0 hover:bg-slate-50 transition-colors cursor-pointer group"
      >
        <Flame className="w-8 h-8 text-orange-600 group-hover:scale-105 transition-transform" />
        <span className="hidden lg:block ml-3 font-bold text-lg text-slate-900 tracking-tight group-hover:text-orange-600 transition-colors">ThermoTrace AI</span>
      </Link>
      
      <nav className="flex-1 py-4 flex flex-col gap-2 px-3 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider hidden lg:block px-3">Main</div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center p-3 rounded-lg transition-colors group",
                isActive 
                  ? "bg-slate-100 text-orange-600 font-medium" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
              <span className="hidden lg:block ml-3">{item.label}</span>
            </Link>
          );
        })}

        <div className="text-xs font-semibold text-slate-400 mt-6 mb-2 uppercase tracking-wider hidden lg:block px-3">Intelligence</div>
        
        {/* Thermo News with NRT Live Reminder Indicator */}
        <button 
          onClick={() => toggleOverlay("news")}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg transition-colors group w-full text-left relative", 
            currentOverlay === "news" ? "bg-slate-100 text-orange-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
          title="Live 24h NASA FIRMS Thermal News Feed"
        >
          <div className="flex items-center">
            <Newspaper className={cn("w-5 h-5", currentOverlay === "news" ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
            <span className="hidden lg:block ml-3">Thermo News</span>
          </div>
          <span className="hidden lg:flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-ping" />
            LIVE NRT
          </span>
        </button>

        {/* Operational Alerts with Unread Badge */}
        <button 
          onClick={() => toggleOverlay("alerts")}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg transition-colors group w-full text-left relative", 
            currentOverlay === "alerts" ? "bg-slate-100 text-orange-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
          title="Critical, Abnormal & Industrial Operational Alerts"
        >
          <div className="flex items-center">
            <Bell className={cn("w-5 h-5", currentOverlay === "alerts" ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
            <span className="hidden lg:block ml-3">Alerts</span>
          </div>
          {unreadAlerts > 0 && (
            <span className="hidden lg:flex items-center justify-center px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-bold">
              {unreadAlerts}
            </span>
          )}
        </button>

        {/* Chat Interface */}
        <button 
          onClick={() => toggleOverlay("chat")}
          className={cn("flex items-center p-3 rounded-lg transition-colors group w-full text-left", currentOverlay === "chat" ? "bg-slate-100 text-orange-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}
        >
          <FlamePlusIcon active={currentOverlay === "chat"} />
          <span className="hidden lg:block ml-3">Chat Interface</span>
        </button>

        <div className="text-xs font-semibold text-slate-400 mt-6 mb-2 uppercase tracking-wider hidden lg:block px-3">System & Guide</div>

        {/* System Guide & Architecture Manual (Dedicated Full Page) */}
        <Link
          href="/guide"
          className={cn(
            "flex items-center p-3 rounded-lg transition-colors group w-full text-left",
            pathname === "/guide"
              ? "bg-slate-100 text-orange-600 font-semibold"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
          title="Authoritative Engineering Architecture, Algorithms & System Guide"
        >
          <BookOpen className={cn("w-5 h-5", pathname === "/guide" ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
          <span className="hidden lg:block ml-3">System Guide & Info</span>
        </Link>
      </nav>
      
      <div className="p-4 border-t border-slate-200 text-center lg:text-left shrink-0">
        <button 
          onClick={() => toggleOverlay("settings")}
          className={cn("flex items-center w-full p-2 rounded transition-colors justify-center lg:justify-start", currentOverlay === "settings" ? "bg-slate-100" : "hover:bg-slate-50")}
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-700 border border-slate-200">
            <User className="w-4 h-4 text-slate-600" />
          </div>
          <div className="hidden lg:block ml-3 text-left">
            <div className="text-sm font-medium text-slate-900">User Profile</div>
            <div className="text-xs text-slate-500">Settings</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
