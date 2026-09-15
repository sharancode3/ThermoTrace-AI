"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  Flame, Building2, FileText, LayoutDashboard, Bell, 
  Newspaper, BarChart2, Menu, X, ChevronRight 
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { fetchNotifications } from "@/lib/apiClient";
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

  return (
    <div ref={menuRef} className="flex md:hidden flex-col w-full sticky top-0 z-[55] bg-white border-b border-slate-200 shadow-sm shrink-0">
      {/* Top Header Bar */}
      <div className="h-14 px-4 flex items-center justify-between bg-white">
        <Link 
          href="/" 
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Flame className="w-7 h-7 text-orange-600 shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-base text-slate-900 leading-tight">ThermoTrace AI</span>
            <span className="text-[10px] text-slate-500 font-mono leading-none">National Thermal Radar</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {unreadAlerts > 0 && (
            <button
              onClick={() => handleOverlayClick("alerts")}
              className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center gap-1 text-xs font-bold"
              title={`${unreadAlerts} Unread Alerts`}
            >
              <Bell className="w-4 h-4 animate-bounce" />
              <span>{unreadAlerts}</span>
            </button>
          )}

          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
            aria-label="Toggle mobile menu"
          >
            {isOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-900" />}
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

          <div className="relative z-[55] bg-white border-t border-slate-100 shadow-xl overflow-hidden animate-in slide-in-from-top duration-200">
            <div className="p-3 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-1 pb-1">
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
                        ? "bg-orange-50 text-orange-700 border border-orange-200 shadow-xs"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", isActive ? "text-orange-600" : "text-slate-500")} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                );
              })}

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-3 pb-1">
                Live Intelligence & Overlays
              </div>

              {/* Thermo News */}
              <button
                onClick={() => handleOverlayClick("news")}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all text-left",
                  currentOverlay === "news"
                    ? "bg-orange-50 text-orange-700 border border-orange-200 shadow-xs"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Newspaper className={cn("w-5 h-5", currentOverlay === "news" ? "text-orange-600" : "text-slate-500")} />
                  <span>Thermo News</span>
                </div>
                <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full border border-orange-200">
                  LIVE NRT
                </span>
              </button>

              {/* Operational Alerts */}
              <button
                onClick={() => handleOverlayClick("alerts")}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all text-left",
                  currentOverlay === "alerts"
                    ? "bg-orange-50 text-orange-700 border border-orange-200 shadow-xs"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Bell className={cn("w-5 h-5", currentOverlay === "alerts" ? "text-orange-600" : "text-slate-500")} />
                  <span>Operational Alerts</span>
                </div>
                {unreadAlerts > 0 ? (
                  <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
                    {unreadAlerts} Unread
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Chat Interface */}
              <button
                onClick={() => handleOverlayClick("chat")}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all text-left",
                  currentOverlay === "chat"
                    ? "bg-orange-50 text-orange-700 border border-orange-200 shadow-xs"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Flame className={cn("w-5 h-5", currentOverlay === "chat" ? "text-orange-600" : "text-slate-500")} />
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-3 h-3 rounded-full bg-orange-600 text-white font-black text-[8px] leading-none ring-1 ring-white">+</span>
                  </div>
                  <span>Ask AI Chat Interface</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
