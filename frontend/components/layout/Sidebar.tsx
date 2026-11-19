"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Camera,
  Users,
  BookOpen,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Settings,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { User } from "@/types";

const mainNav = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Attendance", href: "/attendance", icon: Camera },
  { name: "Timetable", href: "/timetable", icon: CalendarDays },
  { name: "Students", href: "/students", icon: Users },
  { name: "Classes", href: "/classes", icon: BookOpen },
  { name: "Reports", href: "/reports", icon: BarChart3 },
];

const manageNav = [
  { name: "Sessions", href: "/sessions", icon: CalendarCheck2 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export const Sidebar: React.FC<{ className?: string; onCloseMobile?: () => void }> = ({
  className,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Load authenticated user info from localStorage or /auth/me
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("attendai_user");
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("attendai_user");
      document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    router.push("/login");
    router.refresh();
  };

  const displayName = user?.full_name || "Faculty account";
  const displayRole = user?.role === "admin" ? "Faculty & Admin" : "Instructor";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={cn(
        "futuristic-sidebar h-screen w-[276px] flex-shrink-0 select-none px-3 py-5 text-left text-primary-text flex flex-col justify-between",
        className
      )}
    >
      <div>
        {/* Brand Header */}
        <div className="mb-9 flex items-center gap-3 px-3">
          <div className="primary-gradient flex h-10 w-10 items-center justify-center rounded-2xl font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-[16px] font-bold tracking-tight leading-tight text-primary-text">
              KIT Kanpur
            </span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.16em] text-secondary-text">
              Academic presence suite
            </span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="space-y-1">
          {mainNav.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  "nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "nav-link-active bg-[var(--primary)] text-white font-semibold"
                    : "text-secondary-text hover:text-primary-text hover:bg-[var(--color-accent-subtle)]"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-white" : "text-muted-text"
                  )}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Manage Section */}
        <div className="mt-8">
          <div className="mb-2 px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-text">
            Operations
          </div>
          <nav className="space-y-1">
            {manageNav.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                  "nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                    isActive
                      ? "nav-link-active bg-[var(--primary)] text-white font-semibold"
                      : "text-secondary-text hover:text-primary-text hover:bg-[var(--color-accent-subtle)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-colors",
                    isActive ? "text-white" : "text-muted-text"
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Profile Footer with Logout */}
      <div className="mx-1 flex items-center justify-between gap-2 rounded-2xl border border-border bg-[var(--color-accent-subtle)] p-2.5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--text)_8%,transparent)]">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[11.5px] font-bold text-[var(--bg)]">
            {initials}
          </div>
          <div className="overflow-hidden">
            <div className="truncate text-[12px] font-semibold text-primary-text">
              {displayName}
            </div>
            <div className="truncate text-[10px] text-secondary-text">
              {displayRole}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-lg p-1.5 text-secondary-text transition-colors hover:bg-[var(--color-accent-subtle)] hover:text-primary-text"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
