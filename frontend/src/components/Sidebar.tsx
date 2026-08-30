"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flame, Building2, FileText, LayoutDashboard, Bell, Newspaper, Plus } from "lucide-react";
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
    <aside className="hidden md:flex flex-col w-20 lg:w-64 border-r border-slate-800 bg-[#0B0F17] text-slate-300 z-50 shadow-2xl relative shrink-0">
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800 shrink-0">
        <Flame className="w-8 h-8 text-orange-600" />
        <span className="hidden lg:block ml-3 font-bold text-lg text-white tracking-tight">Thermo AI</span>
      </div>
      
      <nav className="flex-1 py-4 flex flex-col gap-2 px-3 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider hidden lg:block px-3 font-mono">Main</div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center p-3 rounded-lg transition-colors group",
                isActive 
                  ? "bg-orange-600/10 text-orange-400 font-medium border border-orange-500/30" 
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-orange-500" : "text-slate-400 group-hover:text-white")} />
              <span className="hidden lg:block ml-3">{item.label}</span>
            </Link>
          );
        })}

        <div className="text-xs font-semibold text-slate-500 mt-6 mb-2 uppercase tracking-wider hidden lg:block px-3 font-mono">Intelligence</div>
        
        <button 
          onClick={() => toggleOverlay("news")}
          className={cn("flex items-center p-3 rounded-lg transition-colors group w-full text-left", currentOverlay === "news" ? "bg-orange-600/10 text-orange-400 font-medium border border-orange-500/30" : "text-slate-400 hover:bg-slate-900 hover:text-white")}
        >
          <Newspaper className={cn("w-5 h-5", currentOverlay === "news" ? "text-orange-500" : "text-slate-400 group-hover:text-white")} />
          <span className="hidden lg:block ml-3">Thermo News</span>
        </button>
        <button 
          onClick={() => toggleOverlay("alerts")}
          className={cn("flex items-center p-3 rounded-lg transition-colors group w-full text-left", currentOverlay === "alerts" ? "bg-orange-600/10 text-orange-400 font-medium border border-orange-500/30" : "text-slate-400 hover:bg-slate-900 hover:text-white")}
        >
          <Bell className={cn("w-5 h-5", currentOverlay === "alerts" ? "text-orange-500" : "text-slate-400 group-hover:text-white")} />
          <span className="hidden lg:block ml-3">Alerts</span>
        </button>
        <button 
          onClick={() => toggleOverlay("chat")}
          className={cn("flex items-center p-3 rounded-lg transition-colors group w-full text-left", currentOverlay === "chat" ? "bg-orange-600/10 text-orange-400 font-medium border border-orange-500/30" : "text-slate-400 hover:bg-slate-900 hover:text-white")}
        >
          <div className="relative inline-flex items-center justify-center">
            <Flame className={cn("w-5 h-5", currentOverlay === "chat" ? "text-orange-500" : "text-slate-400 group-hover:text-white")} />
            <Plus className="w-2.5 h-2.5 text-orange-400 absolute -top-1 -right-1 stroke-[3]" />
          </div>
          <span className="hidden lg:block ml-3">Chat Interface</span>
        </button>
        
      </nav>
      
      <div className="p-4 border-t border-slate-800 text-center lg:text-left shrink-0">
        <button 
          onClick={() => toggleOverlay("settings")}
          className={cn("flex items-center w-full p-2 rounded-lg transition-colors justify-center lg:justify-start", currentOverlay === "settings" ? "bg-slate-900 border border-slate-700" : "hover:bg-slate-900")}
        >
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-orange-400 border border-slate-700">
            NT
          </div>
          <div className="hidden lg:block ml-3 text-left">
            <div className="text-sm font-medium text-white">NTRO Operator</div>
            <div className="text-xs text-slate-500">Settings</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
