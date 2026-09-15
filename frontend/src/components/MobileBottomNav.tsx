"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, Building2, FileText, BarChart2, Bell, Newspaper, Flame
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchNotifications } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
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

  const navItems = [
    { label: "Monitor", icon: LayoutDashboard, href: "/monitor", isOverlay: false },
    { label: "Facilities", icon: Building2, href: "/facilities", isOverlay: false },
    { label: "Reports", icon: FileText, href: "/reports", isOverlay: false },
    { label: "Analytics", icon: BarChart2, href: "/analytics", isOverlay: false },
    { label: "News", icon: Newspaper, overlayName: "news", isOverlay: true },
    { label: "Alerts", icon: Bell, overlayName: "alerts", isOverlay: true, badge: unreadAlerts },
    { label: "Chat", icon: Flame, overlayName: "chat", isOverlay: true },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 z-40 flex md:hidden items-center justify-around py-1.5 px-1 shadow-2xl">
      {navItems.map((item) => {
        const isActive = item.isOverlay 
          ? currentOverlay === item.overlayName 
          : (pathname === item.href && !currentOverlay);

        if (item.isOverlay) {
          return (
            <button
              key={item.label}
              onClick={() => toggleOverlay(item.overlayName!)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-lg transition-colors relative min-w-0 cursor-pointer",
                isActive ? "text-orange-500 font-bold" : "text-slate-400 hover:text-slate-200"
              )}
              type="button"
            >
              <div className="relative">
                <item.icon className="w-5 h-5 shrink-0" />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-600 text-white rounded-full text-[8px] font-black flex items-center justify-center ring-1 ring-slate-900">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[52px]">{item.label}</span>
            </button>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href!}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-lg transition-colors relative min-w-0 cursor-pointer",
              isActive ? "text-orange-500 font-bold" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[52px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
