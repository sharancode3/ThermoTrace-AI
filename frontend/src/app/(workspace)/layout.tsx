import { Sidebar } from "@/components/Sidebar";
import { OverlayManager } from "@/components/OverlayManager";
import { GlobalFirmsPoller } from "@/components/GlobalFirmsPoller";
import { Suspense } from "react";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden relative">
      <GlobalFirmsPoller />
      <Suspense fallback={<div className="w-20 lg:w-64 border-r border-slate-800 bg-slate-900" />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 relative overflow-hidden">
        {children}
      </main>
      <Suspense fallback={null}>
        <OverlayManager />
      </Suspense>
    </div>
  );
}
