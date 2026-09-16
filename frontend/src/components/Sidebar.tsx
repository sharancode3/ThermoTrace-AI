"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  Flame, Building2, FileText, LayoutDashboard, Bell, 
  Newspaper, BookOpen, BarChart2, User, ChevronLeft, ChevronRight, HelpCircle, Sparkles, Sun, Moon
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchNotifications } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useTour } from "@/components/tour/TourContext";
import { useTheme } from "@/components/ThemeContext";

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
  const { startTour, retriggerTour } = useTour();

  // Read saved collapse state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("thermo_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch (e) {}
  }, []);

  // Dynamically update --sidebar-width CSS variable whenever collapse state changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      isCollapsed ? "4rem" : "16rem"
    );
  }, [isCollapsed]);

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

  const { theme, toggleTheme } = useTheme();

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 z-50 shadow-sm relative shrink-0 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Vertically Centered Sidebar Collapse Toggle Arrow */}
      <button
        onClick={toggleCollapse}
        title={isCollapsed ? "Expand Navigation Sidebar (Click →)" : "Collapse Navigation Sidebar (Click ←)"}
        className="absolute top-1/2 -translate-y-1/2 -right-4 z-[60] w-8 h-8 rounded-full bg-orange-600 hover:bg-orange-500 shadow-md shadow-orange-600/30 flex items-center justify-center text-white dark:text-black transition-all hover:scale-110 active:scale-95 cursor-pointer"
        type="button"
      >
        {isCollapsed ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <ChevronLeft className="w-5 h-5" />
        )}
      </button>

      {/* Sidebar Header */}
      <div className={cn("h-16 flex items-center border-b border-slate-200 dark:border-slate-800 shrink-0", isCollapsed ? "justify-center px-2" : "justify-start px-4")}>
        <Link 
          href="/" 
          title="Return to ThermoTrace AI Landing Page" 
          className="flex items-center hover:opacity-90 transition-opacity cursor-pointer group min-w-0"
        >
          <Flame className="w-8 h-8 text-orange-600 group-hover:scale-105 transition-transform shrink-0" />
          {!isCollapsed && (
            <span className="ml-3 font-bold text-lg text-slate-900 dark:text-white tracking-tight group-hover:text-orange-600 transition-colors truncate">
              ThermoTrace AI
            </span>
          )}
        </Link>
      </div>
      
      <nav className="flex-1 py-3 flex flex-col gap-1 px-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {!isCollapsed && (
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-400 mb-1.5 uppercase tracking-wider px-3">
            Main
          </div>
        )}
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          const dataTourKey = `sidebar-${item.href.replace("/", "")}`;
          return (
            <div key={item.label} className="relative group flex items-center">
              <Link
                href={item.href}
                data-tour={dataTourKey}
                className={cn(
                  "flex items-center py-2 px-3 rounded-lg transition-colors w-full group font-medium",
                  isCollapsed ? "justify-center" : "justify-start",
                  isActive 
                    ? "bg-slate-100 dark:bg-slate-800/90 text-orange-600 dark:text-orange-400 font-semibold" 
                    : "text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-300 group-hover:text-slate-700 dark:group-hover:text-white")} />
                {!isCollapsed && <span className="ml-3 truncate">{item.label}</span>}
              </Link>

              {/* Floating Hover Tooltip Preview in Collapsed State */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
                  {item.label}
                </div>
              )}
            </div>
          );
        })}

        {!isCollapsed && (
          <div className="text-xs font-bold text-slate-400 dark:text-slate-300 mt-5 mb-1.5 uppercase tracking-wider px-3">
            Intelligence
          </div>
        )}
        
        {/* Thermo News */}
        <div className="relative group flex items-center">
          <button 
            onClick={() => toggleOverlay("news")}
            data-tour="sidebar-news"
            className={cn(
              "flex items-center justify-between py-2 px-3 rounded-lg transition-colors group w-full text-left relative cursor-pointer font-medium", 
              isCollapsed ? "justify-center" : "",
              currentOverlay === "news" ? "bg-slate-100 dark:bg-slate-800/90 text-orange-600 dark:text-orange-400 font-semibold" : "text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
            )}
            type="button"
          >
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "")}>
              <Newspaper className={cn("w-5 h-5 shrink-0", currentOverlay === "news" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-300 group-hover:text-slate-700 dark:group-hover:text-white")} />
              {!isCollapsed && <span className="ml-3 truncate">Thermo News</span>}
            </div>
            {!isCollapsed && (
              <span className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/70 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-ping" />
                LIVE NRT
              </span>
            )}
          </button>
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              Thermo News
            </div>
          )}
        </div>

        {/* Operational Alerts */}
        <div className="relative group flex items-center">
          <button 
            onClick={() => toggleOverlay("alerts")}
            data-tour="sidebar-alerts"
            className={cn(
              "flex items-center justify-between py-2 px-3 rounded-lg transition-colors group w-full text-left relative cursor-pointer font-medium", 
              isCollapsed ? "justify-center" : "",
              currentOverlay === "alerts" ? "bg-slate-100 dark:bg-slate-800/90 text-orange-600 dark:text-orange-400 font-semibold" : "text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
            )}
            type="button"
          >
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "")}>
              <Bell className={cn("w-5 h-5 shrink-0", currentOverlay === "alerts" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-300 group-hover:text-slate-700 dark:group-hover:text-white")} />
              {!isCollapsed && <span className="ml-3 truncate">Alerts</span>}
            </div>
            {unreadAlerts > 0 && (
              <span className={cn(
                "flex items-center justify-center bg-red-600 text-white rounded-full text-[10px] font-bold shrink-0",
                isCollapsed ? "absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px]" : "px-1.5 py-0.2"
              )}>
                {unreadAlerts}
              </span>
            )}
          </button>
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              Alerts
            </div>
          )}
        </div>

        {/* Chat Interface */}
        <div className="relative group flex items-center">
          <button 
            onClick={() => toggleOverlay("chat")}
            data-tour="sidebar-chat"
            className={cn(
              "flex items-center py-2 px-3 rounded-lg transition-colors group w-full text-left cursor-pointer font-medium", 
              isCollapsed ? "justify-center" : "",
              currentOverlay === "chat" ? "bg-slate-100 dark:bg-slate-800/90 text-orange-600 dark:text-orange-400 font-semibold" : "text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
            )}
            type="button"
          >
            <FlamePlusIcon active={currentOverlay === "chat"} />
            {!isCollapsed && <span className="ml-3 truncate">Chat Interface</span>}
          </button>
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              Chat Interface
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="text-xs font-bold text-slate-400 dark:text-slate-300 mt-5 mb-1.5 uppercase tracking-wider px-3">
            System & Guide
          </div>
        )}

        {/* System Guide */}
        <div className="relative group flex items-center">
          <Link
            href="/guide"
            data-tour="sidebar-guide"
            className={cn(
              "flex items-center py-2 px-3 rounded-lg transition-colors group w-full text-left font-medium",
              isCollapsed ? "justify-center" : "",
              pathname === "/guide"
                ? "bg-slate-100 dark:bg-slate-800/90 text-orange-600 dark:text-orange-400 font-semibold"
                : "text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <BookOpen className={cn("w-5 h-5 shrink-0", pathname === "/guide" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-300 group-hover:text-slate-700 dark:group-hover:text-white")} />
            {!isCollapsed && <span className="ml-3 truncate">System Guide & Info</span>}
          </Link>
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              System Guide & Info
            </div>
          )}
        </div>

        {/* Persistent Take a Tour Button */}
        <div className="relative group flex items-center mt-1">
          <button
            type="button"
            onClick={retriggerTour}
            data-tour="take-tour-btn"
            className={cn(
              "flex items-center py-2 px-3 rounded-lg transition-colors group w-full text-left bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900/80 border border-orange-200/80 dark:border-orange-800/80 text-orange-700 dark:text-orange-300 font-bold cursor-pointer",
              isCollapsed ? "justify-center" : ""
            )}
          >
            <Sparkles className="w-5 h-5 shrink-0 text-orange-600 dark:text-orange-400" />
            {!isCollapsed && <span className="ml-3 truncate">Take a Tour</span>}
          </button>
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              Take a Tour
            </div>
          )}
        </div>
      </nav>
      
      {/* Sidebar Footer: Theme Toggle + User Profile */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-1">
        {/* Theme Toggle Button */}
        <div className="relative group flex items-center">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className={cn(
              "flex items-center w-full p-2 rounded-lg transition-colors text-xs font-semibold cursor-pointer",
              isCollapsed ? "justify-center" : "justify-between",
              theme === "dark"
                ? "bg-slate-800 text-amber-300 hover:bg-slate-750"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            <div className="flex items-center gap-2.5">
              {theme === "dark" ? (
                <Moon className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Sun className="w-4 h-4 text-orange-500 shrink-0" />
              )}
              {!isCollapsed && (
                <span className="font-bold">{theme === "dark" ? "Dark Theme" : "Light Theme"}</span>
              )}
            </div>
            {!isCollapsed && (
              <div className={cn(
                "w-8 h-4 rounded-full p-0.5 transition-colors relative flex items-center",
                theme === "dark" ? "bg-orange-600" : "bg-slate-300"
              )}>
                <div className={cn(
                  "w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-sm",
                  theme === "dark" ? "translate-x-4" : "translate-x-0"
                )} />
              </div>
            )}
          </button>
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            </div>
          )}
        </div>

        {/* User Profile Row */}
        <div className="relative group flex items-center">
          <button 
            onClick={() => toggleOverlay("settings")}
            className={cn(
              "flex items-center w-full p-2 rounded-lg transition-colors justify-center", 
              !isCollapsed ? "justify-start" : "",
              currentOverlay === "settings" ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
            )}
            type="button"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0">
              <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </div>
            {!isCollapsed && (
              <div className="ml-3 text-left truncate">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">User Profile</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">Settings</div>
              </div>
            )}
          </button>
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              User Settings
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
