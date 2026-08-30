"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flame, Building2, FileText, Settings, LayoutDashboard, Bell, Newspaper, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Monitor", href: "/monitor" },
  { icon: Building2, label: "Facilities", href: "/facilities" },
  { icon: FileText, label: "Reports", href: "/reports" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentOverlay = searchParams.get("overlay");

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
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-200 shrink-0">
        <Flame className="w-8 h-8 text-orange-600" />
        <span className="hidden lg:block ml-3 font-bold text-lg text-slate-900 tracking-tight">Thermo AI</span>
      </div>
      
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
        
        <button 
          onClick={() => toggleOverlay("news")}
          className={cn("flex items-center p-3 rounded-lg transition-colors group w-full text-left", currentOverlay === "news" ? "bg-slate-100 text-orange-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}
        >
          <Newspaper className={cn("w-5 h-5", currentOverlay === "news" ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
          <span className="hidden lg:block ml-3">Thermo News</span>
        </button>
        <button 
          onClick={() => toggleOverlay("alerts")}
          className={cn("flex items-center p-3 rounded-lg transition-colors group w-full text-left", currentOverlay === "alerts" ? "bg-slate-100 text-orange-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}
        >
          <Bell className={cn("w-5 h-5", currentOverlay === "alerts" ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
          <span className="hidden lg:block ml-3">Alerts</span>
        </button>
        <button 
          onClick={() => toggleOverlay("chat")}
          className={cn("flex items-center p-3 rounded-lg transition-colors group w-full text-left", currentOverlay === "chat" ? "bg-slate-100 text-orange-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}
        >
          <MessageSquare className={cn("w-5 h-5", currentOverlay === "chat" ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700")} />
          <span className="hidden lg:block ml-3">Chat Interface</span>
        </button>
        
      </nav>
      
      <div className="p-4 border-t border-slate-200 text-center lg:text-left shrink-0">
        <button 
          onClick={() => toggleOverlay("settings")}
          className={cn("flex items-center w-full p-2 rounded transition-colors justify-center lg:justify-start", currentOverlay === "settings" ? "bg-slate-100" : "hover:bg-slate-50")}
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-700 border border-slate-200">
            NT
          </div>
          <div className="hidden lg:block ml-3 text-left">
            <div className="text-sm font-medium text-slate-900">NTRO Operator</div>
            <div className="text-xs text-slate-500">Settings</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
