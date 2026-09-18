"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  Flame, Building2, FileText, LayoutDashboard, Bell, 
  Newspaper, BarChart2, Menu, X, ChevronRight, Sparkles, HelpCircle, Sun, Moon 
} from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { fetchNotifications } from "@/lib/apiClient";
import { useTour } from "@/components/tour/TourContext";
import { useTheme } from "@/components/ThemeContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Monitor", href: "/monitor" },
  { icon: Building2, label: "Facilities", href: "/facilities" },
  { icon: FileText, label: "Reports", href: "/reports" },
  { icon: BarChart2, label: "National Analytics", href: "/analytics" },
];

export function MobileTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentOverlay = searchParams.get("overlay");
  const { retriggerTour } = useTour();
  const { theme, toggleTheme } = useTheme();
  
  const [isOpen, setIsOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Poll notifications count
  useEffect(() => {
    fetchNotifications()
      .then((notifs) => {
        if (Array.isArray(notifs)) {
          setUnreadAlerts(notifs.filter((n: any) => !n.is_read).length);
        }
      })
      .catch(() => {});
  }, [currentOverlay]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname, searchParams]);

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    // If overlay is open, clear it when switching main page
    const params = new URLSearchParams(searchParams.toString());
    params.delete("overlay");
    const q = params.toString();
    router.push(`${href}${q ? "?" + q : ""}`);
  };

  const handleOverlayClick = (overlayName: string) => {
    setIsOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (currentOverlay === overlayName) {
      params.delete("overlay");
    } else {
      params.set("overlay", overlayName);
    }
    const newQuery = params.toString();
    router.push(`${pathname}${newQuery ? "?" + newQuery : ""}`);
  };

  const pageTitle = useMemo(() => {
    if (currentOverlay === "news") return "Thermo News";
    if (currentOverlay === "alerts") return "Alerts";
    if (currentOverlay === "chat") return "AI Chat";
    if (pathname.startsWith("/facilities")) return "Facilities";
    if (pathname.startsWith("/reports")) return "Reports";
    if (pathname.startsWith("/analytics")) return "Analytics";
    if (pathname.startsWith("/guide")) return "Guide";
    return "Monitor";
  }, [pathname, currentOverlay]);

  return (
    <div ref={menuRef} className="flex md:hidden flex-col w-full sticky top-0 z-[55] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
      {/* Top Header Bar */}
      <div className="h-14 px-4 flex items-center justify-between bg-white dark:bg-slate-900">
        <Link 
          href="/" 
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity min-w-0"
        >
          <Flame className="w-6 h-6 text-orange-600 shrink-0" />
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">ThermoTrace</span>
            <span className="text-slate-400 dark:text-slate-600 font-normal text-xs hidden sm:inline">/</span>
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 font-mono truncate hidden sm:inline">{pageTitle}</span>
          </div>
        </Link>

        {/* Action Controls: Round Theme Toggle, Tour Button & Hamburger Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-transform active:scale-95 cursor-pointer shrink-0 shadow-2xs"
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              <Moon className="w-4 h-4 text-amber-400" />
            ) : (
              <Sun className="w-4 h-4 text-orange-500" />
            )}
          </button>

          <button
            type="button"
            onClick={retriggerTour}
            className="p-1.5 px-2 rounded-xl text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/60 transition-colors border border-orange-200 dark:border-orange-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
            title="Restart Guided Tour"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            <span className="hidden min-[380px]:inline">Tour</span>
          </button>

          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 shrink-0"
            aria-label="Toggle mobile menu"
          >
            {isOpen ? <X className="w-5 h-5 text-slate-900 dark:text-slate-100" /> : <Menu className="w-5 h-5 text-slate-900 dark:text-slate-100" />}
          </button>
        </div>
      </div>

      {/* Slide-Down Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop blur overlay */}
          <div 
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 top-14 bg-slate-900/40 backdrop-blur-xs z-[54] animate-in fade-in"
          />

          <div className="relative z-[55] bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden animate-in slide-in-from-top duration-200">
            <div className="p-3 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-1 pb-1">
                Main Views
              </div>

              {NAV_ITEMS.map((item) => {
                const isActive = pathname?.startsWith(item.href) && !currentOverlay;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item.href)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all text-left",
                      isActive
                        ? "bg-orange-50 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 shadow-xs"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", isActive ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400")} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </button>
                );
              })}

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-3 pb-1">
                Live Intelligence & Overlays
              </div>

              {/* Thermo News */}
              <button
                onClick={() => handleOverlayClick("news")}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all text-left",
                  currentOverlay === "news"
                    ? "bg-orange-50 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 shadow-xs"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <Newspaper className={cn("w-5 h-5", currentOverlay === "news" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400")} />
                  <span>Thermo News</span>
                </div>
                <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">
                  LIVE NRT
                </span>
              </button>

              {/* Operational Alerts */}
              <button
                onClick={() => handleOverlayClick("alerts")}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all text-left",
                  currentOverlay === "alerts"
                    ? "bg-orange-50 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 shadow-xs"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <Bell className={cn("w-5 h-5", currentOverlay === "alerts" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400")} />
                  <span>Operational Alerts</span>
                </div>
                {unreadAlerts > 0 ? (
                  <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
                    {unreadAlerts} Unread
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                )}
              </button>

              {/* Chat Interface */}
              <button
                onClick={() => handleOverlayClick("chat")}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all text-left",
                  currentOverlay === "chat"
                    ? "bg-orange-50 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 shadow-xs"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Flame className={cn("w-5 h-5", currentOverlay === "chat" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400")} />
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-3 h-3 rounded-full bg-orange-600 text-white font-black text-[8px] leading-none ring-1 ring-white">+</span>
                  </div>
                  <span>Ask AI Chat Interface</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </button>

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-3 pb-1">
                Appearance & Theme
              </div>

              {/* Mobile Theme Toggle Item */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-sm font-semibold transition-all text-left bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                    {theme === "dark" ? (
                      <Moon className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Sun className="w-4 h-4 text-orange-500" />
                    )}
                  </div>
                  <span>{theme === "dark" ? "Dark Mode Active" : "Light Mode Active"}</span>
                </div>
                <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold px-2 py-1 bg-orange-50 dark:bg-orange-950/60 rounded-lg border border-orange-200 dark:border-orange-800">Switch Theme</span>
              </button>

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-3 pb-1">
                Guided Tour
              </div>

              {/* Restart Platform Tour */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  retriggerTour();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold text-orange-700 dark:text-orange-300 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900/80 border border-orange-200/80 dark:border-orange-800/80 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <span>Restart Platform Tour</span>
                </div>
                <span className="text-[10px] font-bold bg-orange-600 text-white px-2 py-0.5 rounded-full">
                  Phase 2 Intro
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
