import { Sidebar } from "@/components/Sidebar";
import { MobileTopNav } from "@/components/MobileTopNav";
import { OverlayManager } from "@/components/OverlayManager";
import { GlobalFirmsPoller } from "@/components/GlobalFirmsPoller";
import { TourProvider } from "@/components/tour/TourContext";
import { TourIntroModal } from "@/components/tour/TourIntroModal";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { TourMessageBox } from "@/components/tour/TourMessageBox";
import { ThemeProvider } from "@/components/ThemeContext";
import { Suspense } from "react";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <TourProvider>
        <div className="flex flex-col md:flex-row h-screen w-full bg-slate-950 overflow-hidden relative">
          <GlobalFirmsPoller />
          <Suspense fallback={null}>
            <MobileTopNav />
          </Suspense>
          <Suspense fallback={<div className="w-20 lg:w-64 border-r border-slate-800 bg-slate-900" />}>
            <Sidebar />
          </Suspense>
          <main className="flex-1 relative h-full min-h-0 overflow-y-auto pb-0">
            {children}
          </main>
          <Suspense fallback={null}>
            <OverlayManager />
          </Suspense>
          <TourIntroModal />
          <TourOverlay />
          <TourMessageBox />
        </div>
      </TourProvider>
    </ThemeProvider>
  );
}

