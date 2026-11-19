"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, Fingerprint, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await api.login(email.trim(), password);
      // Store user metadata and JWT token in localStorage for API authentication
      if (typeof window !== "undefined") {
        localStorage.setItem("attendai_user", JSON.stringify(data.user));
        localStorage.setItem("attendai_token", data.access_token);
        // Set client-accessible auth cookie to coordinate with Next.js middleware
        document.cookie = `auth_token=${data.access_token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
      }

      success(`Welcome back, ${data.user.full_name}!`);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(
        err.message || "Invalid credentials. Please verify your email and password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-shell flex min-h-screen w-full items-center justify-center p-4 selection:bg-accent/20 md:p-7">
      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-border bg-[var(--bg)] shadow-[0_38px_100px_color-mix(in_srgb,var(--bg)_74%,transparent)] lg:grid-cols-[1.06fr_0.94fr]">
        <section className="login-feature hidden min-h-[650px] flex-col justify-between p-9 lg:flex">
          <div className="relative z-10 flex items-center gap-3">
            <div className="primary-gradient flex h-11 w-11 items-center justify-center rounded-2xl"><ShieldCheck className="h-5 w-5" /></div>
            <div><p className="font-display text-[20px] font-bold leading-none text-primary-text">KIT Kanpur</p><p className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-secondary-text">Attendance intelligence</p></div>
          </div>

          <div className="relative z-10 max-w-md">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-[var(--color-accent-subtle)] px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-accent"><Sparkles className="h-3.5 w-3.5" /> Academic operations, refined</div>
            <h1 className="font-display text-[52px] font-bold leading-[0.95] tracking-[-0.055em] text-primary-text">Presence, made <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] bg-clip-text text-transparent">beautifully</span> simple.</h1>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-secondary-text">A considered workspace for KIT Kanpur faculty—designed to make every attendance session clear, calm, and accountable.</p>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-3">
            <div className="glass-card p-4"><Fingerprint className="h-4 w-4 text-accent" /><p className="mt-5 text-[13px] font-semibold text-primary-text">Face-aware review</p><p className="mt-1 text-[11px] leading-relaxed text-secondary-text">Every recognition remains in your control.</p></div>
            <div className="glass-card p-4"><GraduationCap className="h-4 w-4 text-accent" /><p className="mt-5 text-[13px] font-semibold text-primary-text">Built for KIT</p><p className="mt-1 text-[11px] leading-relaxed text-secondary-text">Real sections, schedules, and class records.</p></div>
          </div>
        </section>

        <section className="flex min-h-[650px] items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-sm">
            <div className="mb-8 space-y-3 text-left lg:hidden">
              <div className="primary-gradient flex h-11 w-11 items-center justify-center rounded-2xl"><ShieldCheck className="h-5 w-5" /></div>
              <div><p className="font-display text-[26px] font-bold tracking-tight text-primary-text">KIT Kanpur</p><p className="mt-1 text-[13px] text-secondary-text">Kanpur Institute of Technology — Attendance Portal</p></div>
            </div>
            <div className="mb-7 text-left">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Secure faculty access</p>
              <h2 className="mt-2 font-display text-[31px] font-bold tracking-[-0.045em] text-primary-text">Welcome back.</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-secondary-text">Sign in to continue to your academic presence workspace.</p>
            </div>

        {/* Login Card */}
        <div className="login-form-card p-6 text-left sm:p-7">
          <form onSubmit={handleLogin} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-danger-subtle border border-danger-border rounded-control text-danger text-[12.5px] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            <div>
              <Input
                label="Email Address"
                type="email"
                placeholder="ajeet.singh@kit.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-primary-text mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-secondary-text absolute left-3 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-9 bg-white text-primary-text text-[14px] placeholder:text-muted-text border border-border rounded-control pl-9 pr-9 transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 p-1 text-secondary-text hover:text-primary-text"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to KIT Kanpur Portal
            </Button>
          </form>

        </div>

        {/* Security, privacy, and maker signature */}
        <div className="mt-5 space-y-3 text-center text-[11.5px] leading-relaxed text-muted-text">
          <p>Privacy-conscious attendance with a complete audit trail.</p>
          <div className="flex justify-center">
            <div className="creator-signature">
              <span className="creator-mark">K</span>
              <span>
                <span className="creator-kicker">Crafted for KIT Kanpur by</span>
                <span className="creator-name">Kanshika Sharma</span>
              </span>
            </div>
          </div>
        </div>
          </div>
        </section>
      </div>
    </div>
  );
}
