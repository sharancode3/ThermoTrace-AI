import { Sidebar } from "@/components/Sidebar";
import { MobileTopNav } from "@/components/MobileTopNav";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { OverlayManager } from "@/components/OverlayManager";
import { GlobalFirmsPoller } from "@/components/GlobalFirmsPoller";
import { Suspense } from "react";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-950 overflow-hidden relative">
      <GlobalFirmsPoller />
      <Suspense fallback={null}>
        <MobileTopNav />
      </Suspense>
      <Suspense fallback={<div className="w-20 lg:w-64 border-r border-slate-800 bg-slate-900" />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 relative h-full min-h-0 overflow-y-auto pb-12 md:pb-0">
        {children}
      </main>
      <Suspense fallback={null}>
        <MobileBottomNav />
        <OverlayManager />
      </Suspense>
    </div>
  );
}
