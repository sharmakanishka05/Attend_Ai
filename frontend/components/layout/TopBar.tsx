"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface TopBarProps {
  onOpenMobile: () => void;
}

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Overview", subtitle: "Here's what's happening with attendance today." },
  "/attendance": { title: "Attendance", subtitle: "Take attendance using camera or upload a classroom photo." },
  "/timetable": { title: "Timetable", subtitle: "Plan periods, prevent conflicts, and open attendance from the schedule." },
  "/students": { title: "Students", subtitle: "Directory of registered students and face biometric data." },
  "/classes": { title: "Classes", subtitle: "Manage courses, sections, schedules, and enrollments." },
  "/reports": { title: "Reports", subtitle: "Analyze attendance trends, class breakdowns, and export records." },
  "/sessions": { title: "Sessions & Audit", subtitle: "Review attendance sessions and manual correction audit logs." },
  "/settings": { title: "Settings", subtitle: "Configure recognition threshold, camera preferences, and privacy controls." },
};

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobile }) => {
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [userName, setUserName] = useState("Faculty account");
  const [lightMode, setLightMode] = useState(false);
  const info = pageTitles[pathname] || { title: "KIT Kanpur" };

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("attendai_user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u.full_name) setUserName(u.full_name);
        } catch {}
      }
    }
  }, []);

  React.useEffect(() => {
    const storedTheme = localStorage.getItem("attendai_theme");
    const shouldUseLight = storedTheme === "light" || (!storedTheme && window.matchMedia("(prefers-color-scheme: light)").matches);
    document.documentElement.classList.toggle("light", shouldUseLight);
    setLightMode(shouldUseLight);
  }, []);

  const toggleTheme = () => {
    const nextMode = !lightMode;
    document.documentElement.classList.toggle("light", nextMode);
    localStorage.setItem("attendai_theme", nextMode ? "light" : "dark");
    setLightMode(nextMode);
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="premium-topbar sticky top-0 z-20 flex h-[76px] items-center justify-between border-b px-5 backdrop-blur-xl md:px-7">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="rounded-xl p-2 text-secondary-text hover:bg-white hover:text-primary-text md:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <p className="mb-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-accent">KIT Kanpur · Presence suite</p>
          <h1 className="font-display text-left text-[20px] font-bold tracking-tight text-primary-text">
            {info.title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Subtle quick search */}
        <div className="relative hidden w-64 sm:flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-secondary-text" />
          <input
            type="text"
            placeholder="Search students, classes..."
            className="h-10 w-full rounded-xl border border-border bg-white/70 pl-9 pr-3 text-[12px] placeholder:text-muted-text focus:border-accent focus:bg-white focus:outline-none transition-colors"
          />
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-xl border border-transparent p-2 text-secondary-text transition-colors hover:border-border hover:bg-white hover:text-primary-text"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
          </button>

          {showNotifications && (
            <div className="glass-card absolute right-0 z-50 mt-2 w-72 p-4 text-left">
              <div className="mb-2 text-[12px] font-semibold text-primary-text">
                Recent Notifications
              </div>
              <p className="text-[12px] text-secondary-text">Notifications appear here when a session needs review or a timetable conflict is found.</p>
            </div>
          )}
        </div>

        <button onClick={toggleTheme} className="rounded-xl border border-border bg-white/70 p-2 text-secondary-text transition-colors hover:bg-white hover:text-primary-text" aria-label={lightMode ? "Use dark theme" : "Use light theme"} title={lightMode ? "Dark mode" : "Light mode"}>
          {lightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        {/* User Pill */}
        <div className="hidden items-center gap-2 border-l border-border pl-3 lg:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)] text-[11px] font-bold text-white">
            {initials}
          </div>
          <span className="text-[12px] font-semibold text-primary-text">
            {userName}
          </span>
        </div>
      </div>
    </header>
  );
};
