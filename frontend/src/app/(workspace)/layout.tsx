import { Sidebar } from "@/components/Sidebar";
import { OverlayManager } from "@/components/OverlayManager";
import { Suspense } from "react";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
      <Suspense fallback={<div className="w-20 lg:w-64 border-r border-slate-200 bg-white" />}>
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
