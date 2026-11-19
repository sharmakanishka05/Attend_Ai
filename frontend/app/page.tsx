"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Camera,
  CalendarCheck2,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Activity,
  CalendarDays,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { AttendanceReportSummary, ClassModel, AuditLogItem } from "@/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<AttendanceReportSummary | null>(null);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [userName, setUserName] = useState("Faculty");
  const [userRole, setUserRole] = useState<"admin" | "teacher">("teacher");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("attendai_user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u.full_name) {
            setUserName(u.full_name.split(" ")[0]);
          }
          if (u.role === "admin" || u.role === "teacher") setUserRole(u.role);
        } catch {}
      }
    }
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [repData, clsData, logsData] = await Promise.all([
        api.getDashboardReport(),
        api.getClasses(),
        api.getAuditLogs(6).catch(() => []),
      ]);
      setSummary(repData);
      setClasses(clsData);
      setAuditLogs(logsData);
    } catch (err) {
      console.warn("Error loading dashboard data:", err);
      setSummary({
        attendance_rate: 0.0,
        present_count: 0,
        absent_count: 0,
        late_count: 0,
        total_records: 0,
        classes_today: 0,
        trend: [],
        class_comparisons: [],
      });
      setClasses([]);
      setAuditLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const trendData = summary?.trend || [];

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const indiaHour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  const greeting = indiaHour < 5 ? "Working late" : indiaHour < 12 ? "Good morning" : indiaHour < 17 ? "Good afternoon" : indiaHour < 22 ? "Good evening" : "Still going strong";
  const roleLabel = userRole === "admin" ? "Administrator" : "Faculty";
  const greetingNote = indiaHour < 12
    ? userRole === "admin" ? "Your campus operations are ready for the day." : "Your class roster and today’s sessions are ready."
    : indiaHour < 17
      ? userRole === "admin" ? "Keep an eye on live attendance and class activity." : "Pick up your next session or review the day so far."
      : userRole === "admin" ? "The day’s attendance activity is ready to review." : "Review completed sessions and close the day with confidence.";

  return (
    <div className="space-y-6 text-left">
      <div className="futuristic-hero relative overflow-hidden rounded-[20px] px-6 py-7 md:px-8">
        <div className="absolute right-0 top-0 h-full w-[38%] opacity-30" style={{ background: "linear-gradient(135deg, transparent, var(--primary))" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-secondary-text">
            <span>{todayFormatted}</span><span className="live-dot" /><span>{roleLabel} workspace</span>
          </div>
          <h1 className="mt-2 font-display text-[40px] leading-[0.96] text-primary-text md:text-[48px]">
            {greeting}, {userName}.
          </h1>
          <p className="mt-2 text-[14px] text-secondary-text">
            {greetingNote}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/attendance">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Camera className="w-4 h-4" />}
            >
              Take Attendance
            </Button>
          </Link>
          <Link href="/reports">
            <Button className="border-border bg-white/10 text-primary-text hover:bg-[var(--color-accent-subtle)]" variant="secondary" size="md">
              View Reports
            </Button>
          </Link>
        </div>
        <div className="hidden rounded-2xl border border-border bg-[var(--bg)]/25 p-2.5 md:block">
          <AttendanceRing value={summary?.attendance_rate ?? 0} />
        </div>
        </div>
      </div>

      {/* Summary Metrics Section (Clean, calm, tabular nums) */}
      <div>
        <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary-text">
          Live signal
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <StatCard
            label="Attendance Rate"
            value={`${summary?.attendance_rate ?? 0}%`}
            trend={{
              value: summary?.total_records ? `${summary.total_records} records verified` : "Live DB",
              isPositive: (summary?.attendance_rate ?? 0) >= 75,
            }}
          />
          <StatCard
            label="Present"
            value={summary?.present_count ?? 0}
            subtext="Sessions on-time"
          />
          <StatCard
            label="Late"
            value={summary?.late_count ?? 0}
            subtext="Excused with notice"
          />
          <StatCard
            label="Absent"
            value={summary?.absent_count ?? 0}
            subtext="Unexcused absentees"
          />
          <StatCard
            label="Classes Today"
            value={summary?.classes_today ?? 0}
            subtext={classes.length > 0 ? `${classes[0].name}` : "No classes"}
          />
        </div>
      </div>

      <AttendanceSignalPanel trend={trendData} overallRate={summary?.attendance_rate ?? 0} totalRecords={summary?.total_records ?? 0} />

      {/* Two Column Layout: Today's Classes & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Classes */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-primary-text">
              Assigned Classes
            </h3>
            <Link
              href="/classes"
              className="text-[12px] text-accent hover:underline flex items-center gap-1 font-medium"
            >
              All Classes <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {classes.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-secondary-text">
                No classes registered in the system.
              </div>
            ) : (
              classes.map((cls) => (
                <div
                  key={cls.id}
                  className="p-3 bg-subtle/70 border border-border rounded-control flex items-center justify-between transition-colors duration-200 hover:border-accent"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[13.5px] text-primary-text">
                        {cls.name}
                      </span>
                      <Badge variant="completed" size="sm">
                        {cls.course}
                      </Badge>
                    </div>
                    <div className="text-[12px] text-secondary-text mt-0.5">
                      {cls.section} • {cls.schedule || "Schedule not set"} • {cls.student_count} students • {cls.teacher_name}
                    </div>
                  </div>
                  <Link href={`/attendance?class_id=${cls.id}`}>
                    <Button size="sm" variant="outline">
                      Take Roll
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-primary-text">
              Recent Activity & Audit
            </h3>
            <Link
              href="/sessions"
              className="text-[12px] text-accent hover:underline flex items-center gap-1 font-medium"
            >
              Session Logs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3.5">
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-secondary-text">
                No audit activity logged yet.
              </div>
            ) : (
              auditLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <span className="text-[11px] font-mono text-secondary-text w-14 flex-shrink-0 pt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex-1">
                    <div className="text-[13px] text-primary-text font-medium">
                      {log.action.replace(/_/g, " ")} • {log.user_name || "System"}
                    </div>
                    <div className="text-[12px] text-secondary-text">
                      {log.details}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendanceRing({ value }: { value: number }) {
  const percentage = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="relative flex h-24 w-24 items-center justify-center" aria-label={`${percentage.toFixed(1)} percent attendance`}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(var(--accent) ${percentage * 3.6}deg, var(--border) 0deg)` }}
      />
      <div className="relative flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full border border-border bg-[var(--surface)]/95 backdrop-blur-sm">
        <span className="font-display text-xl font-bold tabular-nums text-primary-text">{percentage.toFixed(0)}%</span>
        <span className="mt-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-secondary-text">attendance</span>
      </div>
    </div>
  );
}

function AttendanceSignalPanel({ trend, overallRate, totalRecords }: { trend: AttendanceReportSummary["trend"]; overallRate: number; totalRecords: number }) {
  const observed = trend
    .map((item, index) => ({ ...item, index, total: item.total ?? item.present + item.absent }))
    .filter((item) => item.total > 0);
  const latest = observed.at(-1);
  const width = 720;
  const height = 220;
  const yFor = (rate: number) => 14 + ((100 - rate) / 100) * 176;
  const xFor = (index: number) => trend.length > 1 ? 20 + (index / (trend.length - 1)) * (width - 40) : width / 2;
  const linePath = observed.map((item, index) => `${index === 0 ? "M" : "L"} ${xFor(item.index)} ${yFor(item.rate)}`).join(" ");
  const areaPath = observed.length > 1 ? `${linePath} L ${xFor(observed.at(-1)!.index)} ${height - 12} L ${xFor(observed[0].index)} ${height - 12} Z` : "";

  return (
    <section className="attendance-signal p-5 md:p-6">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent"><Activity className="h-3.5 w-3.5" /> Attendance signal</div>
          <h2 className="mt-2 font-display text-[25px] font-bold tracking-[-0.045em] text-primary-text">How attendance is actually moving.</h2>
          <p className="mt-1 text-[13px] text-secondary-text">Only dates with completed records are plotted. Empty dates remain empty.</p>
        </div>
        <div className="rounded-2xl border border-border bg-[var(--bg)]/35 px-4 py-3 text-right">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-secondary-text">Overall rate</div>
          <div className="mt-1 font-display text-[27px] font-bold leading-none text-primary-text">{overallRate.toFixed(1)}<span className="text-[15px] text-accent">%</span></div>
        </div>
      </div>

      {observed.length === 0 ? (
        <div className="relative z-10 mt-7 flex min-h-[230px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-[var(--bg)]/20 px-5 text-center">
          <CalendarDays className="h-6 w-6 text-accent" />
          <h3 className="mt-3 text-[15px] font-semibold text-primary-text">Your attendance story begins with the first session.</h3>
          <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-secondary-text">There are no completed session records in the selected fourteen-day window—so we are not drawing an artificial 0% chart.</p>
          <Link href="/attendance" className="mt-4"><Button variant="primary" size="sm" leftIcon={<Camera className="h-3.5 w-3.5" />}>Start a session</Button></Link>
        </div>
      ) : (
        <>
          <div className="relative z-10 mt-7 h-[246px] w-full">
            <div className="absolute inset-y-0 left-0 flex w-8 flex-col justify-between pt-1 text-right font-mono text-[9px] text-muted-text"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
            <svg className="h-full w-full overflow-visible pl-10" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Attendance rate over recorded sessions">
              <defs>
                <linearGradient id="attendance-area" x1="0" x2="0" y1="0" y2="1"><stop stopColor="var(--primary)" stopOpacity="0.38" /><stop offset="1" stopColor="var(--primary)" stopOpacity="0" /></linearGradient>
                <linearGradient id="attendance-line" x1="0" x2="1" y1="0" y2="0"><stop stopColor="var(--primary)" /><stop offset="1" stopColor="var(--accent)" /></linearGradient>
              </defs>
              {[0, 25, 50, 75, 100].map((rate) => <line key={rate} x1="20" x2={width - 20} y1={yFor(rate)} y2={yFor(rate)} stroke="var(--border)" strokeWidth="1" strokeDasharray={rate === 0 ? "0" : "4 8"} />)}
              {areaPath && <path d={areaPath} fill="url(#attendance-area)" />}
              {observed.length > 1 && <path d={linePath} fill="none" stroke="url(#attendance-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
              {observed.map((item) => <g key={item.date}><circle cx={xFor(item.index)} cy={yFor(item.rate)} r="8" fill="var(--bg)" stroke="var(--accent)" strokeWidth="3" /><circle cx={xFor(item.index)} cy={yFor(item.rate)} r="2.5" fill="var(--accent)" /><title>{`${item.label}: ${item.rate}% — ${item.present} present, ${item.absent} absent`}</title></g>)}
            </svg>
          </div>
          <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 font-mono text-[10px] text-secondary-text">
            <span>{observed.length} session day{observed.length === 1 ? "" : "s"} observed in the last 14 days</span>
            <span>{latest ? `${latest.label} · ${latest.total} records · ${latest.rate}%` : `${totalRecords} total records`}</span>
          </div>
        </>
      )}
    </section>
  );
}
