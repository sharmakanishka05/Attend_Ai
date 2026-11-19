"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isLoginPage = pathname === "/login";

  return (
    <html lang="en">
      <head>
        <title>KIT Kanpur — Attendance Management System</title>
        <meta
          name="description"
          content="Official Kanpur Institute of Technology attendance management portal for faculty and students."
        />
        <meta name="author" content="Kanshika Sharma" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="min-h-screen bg-canvas text-primary-text flex overflow-hidden">
        <ToastProvider>
          {isLoginPage ? (
            <main className="w-full h-screen overflow-y-auto">{children}</main>
          ) : (
            <>
              {/* Desktop Fixed Sidebar */}
              <div className="hidden md:block">
                <Sidebar />
              </div>

              {/* Mobile Drawer */}
              <MobileDrawer
                isOpen={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
              />

              {/* Main Application Area */}
              <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <TopBar onOpenMobile={() => setMobileDrawerOpen(true)} />
                <main className="animate-fade-up flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                  <div className="max-w-7xl mx-auto w-full">
                    {children}
                    <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
                      <div className="creator-signature">
                        <span className="creator-mark">K</span>
                        <span>
                          <span className="creator-kicker">Designed & authored by</span>
                          <span className="creator-name">Kanshika Sharma</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-secondary-text">
                        <span className="live-dot" /> KIT Kanpur · AttendAI
                      </div>
                    </footer>
                  </div>
                </main>
              </div>
            </>
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
