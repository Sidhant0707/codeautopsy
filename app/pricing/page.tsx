// app/pricing/page.tsx
"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { FaCheck, FaLock, FaGithub } from "react-icons/fa";

// ─── Razorpay SDK types ───────────────────────────────────────────────────────
interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}
interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
  theme: { color: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal: { ondismiss: () => void; escape: boolean };
}
interface RazorpayInstance { open: () => void; close: () => void; }
interface RazorpayConstructor { new (options: RazorpayOptions): RazorpayInstance; }
declare global { interface Window { Razorpay: RazorpayConstructor; } }

// ─── Checkout payload ─────────────────────────────────────────────────────────
interface CheckoutPayload {
  subscription_id: string;
  key: string;
  email: string;
  name: string;
}
function isCheckoutPayload(value: unknown): value is CheckoutPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.subscription_id === "string" && v.subscription_id.length > 0 &&
    typeof v.key === "string" && v.key.startsWith("rzp_") &&
    typeof v.email === "string" && v.email.includes("@") &&
    typeof v.name === "string"
  );
}

// ─── Razorpay script loader ───────────────────────────────────────────────────
let rzpScriptPromise: Promise<void> | null = null;
function ensureRazorpayLoaded(): Promise<void> {
  if (rzpScriptPromise !== null) return rzpScriptPromise;
  rzpScriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") { reject(new Error("Browser only")); return; }
    if (typeof window.Razorpay === "function") { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (typeof window.Razorpay !== "function") { rzpScriptPromise = null; reject(new Error("SDK unavailable")); return; }
      resolve();
    };
    script.onerror = () => { rzpScriptPromise = null; reject(new Error("Failed to load payment SDK.")); };
    document.body.appendChild(script);
  });
  return rzpScriptPromise;
}

// ─── Pricing data ─────────────────────────────────────────────────────────────
interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: readonly string[];
  cta: string;
  isPrimary: boolean;
  status: "active" | "coming-soon";
  badge?: string;
  href: string;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Intern", price: "$0", period: "/forever",
    description: "For learning, scouting, and lightweight repo analysis.",
    features: ["10 autopsies / day", "Llama-3.3 70B engine", "Basic architecture maps"],
    cta: "Get Started", isPrimary: false, status: "active", href: "/",
  },
  {
    name: "Specialist", price: "$2", period: "/mo",
    description: "For engineers using CodeAutopsy in daily work.",
    features: ["100 autopsies / day", "Private repositories", "Advanced model routing", "Markdown exports", "Priority analysis queue"],
    cta: "Upgrade to Specialist", isPrimary: true, status: "active", badge: "Early Access", href: "/pricing",
  },
  {
    name: "Chief Surgeon", price: "Custom", period: "/team",
    description: "For teams with deeper security and workflow needs.",
    features: ["Unlimited analysis", "Team collaboration", "Custom AI models", "Workflow integrations"],
    cta: "Waitlist", isPrimary: false, status: "coming-soon", badge: "Coming Soon", href: "#",
  },
];

interface CardMeta { borderClass: string; bgClass: string; tagClass: string; hasGlow: boolean; }
const CARD_META: Record<string, CardMeta> = {
  Intern:        { borderClass: "border-white/[0.06]", bgClass: "bg-white/[0.02]",   tagClass: "bg-white/5 text-slate-500",  hasGlow: false },
  Specialist:    { borderClass: "border-white/20",     bgClass: "bg-white/[0.05]",   tagClass: "bg-white/10 text-white",     hasGlow: true  },
  "Chief Surgeon":{ borderClass: "border-white/[0.04]",bgClass: "bg-white/[0.015]", tagClass: "bg-white/5 text-slate-600",  hasGlow: false },
};

// ─── Variants ─────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, delay: i * 0.07, ease: "easeOut" },
  }),
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const resetLoadingState = () => { setLoading(false); inFlight.current = false; };

  async function handleUpgrade(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    let modalOpened = false;
    try {
      await ensureRazorpayLoaded();
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) { setError("Unable to start checkout. Please try again."); return; }
      const raw: unknown = await res.json();
      if (!isCheckoutPayload(raw)) { setError("Received an invalid response. Please contact support."); return; }
      const rzp = new window.Razorpay({
        key: raw.key, subscription_id: raw.subscription_id,
        name: "CodeAutopsy", description: "Specialist Plan — $2 / month",
        prefill: { name: raw.name, email: raw.email },
        theme: { color: "#ffffff" },
        handler: () => { router.push("/?upgraded=true"); },
        modal: { ondismiss: resetLoadingState, escape: false },
      });
      rzp.open();
      modalOpened = true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      if (!modalOpened) resetLoadingState();
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-slate-300 font-satoshi overflow-x-hidden">

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full opacity-[0.06] bg-blue-400 blur-[60px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.03] bg-white blur-[80px]" />
        <div className="absolute -bottom-10 -right-10 w-80 h-80 rounded-full opacity-[0.04] bg-emerald-400 blur-[60px]" />
      </div>

      {/*
        ── Layout: single scrollable column, tightly padded
           px-4 sm:px-6 lg:px-8  — breathing room on every breakpoint
           py-6 sm:py-10         — top/bottom padding, not py-24
      */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="mb-6 sm:mb-8"       /* was mb-16 */
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-300 text-[10px] font-bold uppercase tracking-widest transition-colors duration-200 cursor-pointer"
          >
            ← Back to Home
          </Link>
        </motion.div>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <motion.div
          initial="hidden" animate="show" custom={0} variants={fadeUp}
          className="mb-8 sm:mb-10 border-t border-white/[0.06] pt-6"  /* was mb-20 pt-10 */
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-600 mb-3">
            Pricing
          </p>

          {/*
            Header row: title left, subtitle right on md+
            Title scales from 3xl → 5xl → 7xl so it never bleeds onto a third line
          */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-6">
            <h1 className="cabinet text-4xl sm:text-5xl lg:text-7xl font-bold text-white tracking-tighter italic uppercase leading-none">
              Choose your{" "}
              <span className="text-transparent [WebkitTextStroke:1px_rgba(255,255,255,0.25)]">
                precision
              </span>
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm max-w-[220px] md:max-w-xs leading-relaxed md:text-right shrink-0">
              Dissect any codebase at the depth your work actually demands.
            </p>
          </div>
        </motion.div>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {error !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="mb-4 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs backdrop-blur-sm"
          >
            {error}
          </motion.div>
        )}

        {/* ── Cards ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {PRICING_PLANS.map((plan: PricingPlan, i: number) => {
            const meta = CARD_META[plan.name] ?? CARD_META["Intern"];
            const isComingSoon = plan.status === "coming-soon";
            const isSpecialist = plan.name === "Specialist";

            return (
              <motion.div
                key={plan.name}
                initial="hidden" animate="show" custom={i + 1} variants={fadeUp}
                className="relative"
              >
                {meta.hasGlow && (
                  <div className="absolute inset-0 rounded-2xl pointer-events-none shadow-[0_0_60px_16px_rgba(120,200,255,0.09)]" />
                )}

                <div
                  className={[
                    "relative h-full flex flex-col rounded-2xl border overflow-hidden backdrop-blur-md",
                    /* Tighter padding: p-5 on mobile, p-6 on sm+ */
                    "p-5 sm:p-6",
                    meta.bgClass, meta.borderClass,
                    isComingSoon ? "opacity-40 cursor-not-allowed select-none" : "",
                  ].filter(Boolean).join(" ")}
                  aria-disabled={isComingSoon ? "true" : "false"}
                >
                  {isSpecialist && (
                    <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                  )}

                  {/* Plan name + badge */}
                  <div className="flex items-start justify-between mb-4 sm:mb-5">
                    <p className={["text-[10px] font-bold uppercase tracking-[0.2em]", isSpecialist ? "text-white" : "text-slate-500"].join(" ")}>
                      {plan.name}
                    </p>
                    {plan.badge && (
                      <span className={["text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10", meta.tagClass].join(" ")}>
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-end gap-1 mb-1">
                    <span className={["font-black tracking-tighter leading-none", plan.price === "Custom" ? "text-2xl text-slate-500 italic" : "text-4xl sm:text-5xl text-white"].join(" ")}>
                      {plan.price}
                    </span>
                    <span className="text-slate-600 text-sm mb-0.5">{plan.period}</span>
                  </div>

                  {isSpecialist && (
                    <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest mb-4">
                      Launch price · Lock in forever
                    </p>
                  )}

                  <p className="text-slate-600 text-[11px] leading-relaxed mt-2 mb-4">
                    {plan.description}
                  </p>

                  <div className="h-px bg-white/[0.05] mb-4" />

                  {/* Features */}
                  <ul className="space-y-2 flex-1">
                    {plan.features.map((feature: string) => (
                      <li key={feature} className={["flex items-center gap-2.5 text-xs", isComingSoon ? "text-slate-700" : isSpecialist ? "text-slate-300" : "text-slate-500"].join(" ")}>
                        {isComingSoon
                          ? <FaLock className="w-2 shrink-0 text-slate-700" />
                          : <FaCheck className={["w-2 shrink-0", isSpecialist ? "text-white" : "text-slate-600"].join(" ")} />
                        }
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-6">
                    {isSpecialist ? (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { void handleUpgrade(); }}
                        disabled={loading}
                        aria-busy={loading}
                        className="w-full py-2.5 rounded-xl bg-white text-[#080808] font-bold text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {loading ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                            Connecting…
                          </span>
                        ) : plan.cta}
                      </motion.button>
                    ) : isComingSoon ? (
                      <button disabled aria-disabled="true"
                        className="w-full py-2.5 rounded-xl border border-white/[0.04] text-slate-700 font-semibold text-[11px] uppercase tracking-widest cursor-not-allowed"
                      >
                        {plan.cta}
                      </button>
                    ) : (
                      <Link href={plan.href}
                        className="block w-full text-center py-2.5 rounded-xl border border-white/[0.08] text-slate-500 font-semibold text-[11px] uppercase tracking-widest hover:border-white/20 hover:text-slate-300 transition-all duration-200 cursor-pointer"
                      >
                        {plan.cta}
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <motion.div
          initial="hidden" animate="show" custom={5} variants={fadeUp}
          className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-3"
        >
          <p className="text-slate-700 text-[11px]">
            Cancel anytime · No hidden fees · Billed monthly via Razorpay
          </p>
          <a
            href="https://github.com/Sidhant0707/codeautopsy"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-700 hover:text-slate-400 text-[11px] transition-colors duration-200 cursor-pointer"
          >
            <FaGithub className="w-3 h-3" />
            Open source on GitHub
          </a>
        </motion.div>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial="hidden" animate="show" custom={6} variants={fadeUp}
          className="mt-8 sm:mt-10 border-t border-white/[0.04] pt-8 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-8"
        >
          {([
            { q: "What counts as an autopsy?", a: "Each unique repository analysis request counts as one autopsy." },
            { q: "Do private repos need a token?", a: "Yes — Specialist users can provide a GitHub PAT to analyze private repositories." },
            { q: "What happens at the limit?", a: "Free users are paused until midnight UTC. No data is lost, no card required." },
          ] as const).map(({ q, a }) => (
            <div key={q}>
              <p className="text-white text-[11px] font-semibold mb-1.5">{q}</p>
              <p className="text-slate-600 text-[11px] leading-relaxed">{a}</p>
            </div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}