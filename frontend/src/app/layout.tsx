import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thermo Intelligence | NTRO",
  description: "Industrial Fire & Persistent Thermal Source Detection Platform",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn(inter.variable, "font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200")}>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('thermo_theme') || 'light';
                const root = document.documentElement;
                if (theme === 'dark') {
                  root.classList.add('dark');
                  root.setAttribute('data-theme', 'dark');
                } else {
                  root.classList.remove('dark');
                  root.setAttribute('data-theme', 'light');
                }
              } catch (e) {}
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
