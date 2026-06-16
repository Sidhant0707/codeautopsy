// app/pricing/page.tsx
"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaCheck, FaLock } from "react-icons/fa";

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

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay: RazorpayConstructor;
  }
}

// ─── Checkout API response type + runtime guard ───────────────────────────────
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
    typeof v.subscription_id === "string" &&
    v.subscription_id.length > 0 &&
    typeof v.key === "string" &&
    v.key.startsWith("rzp_") &&
    typeof v.email === "string" &&
    v.email.includes("@") &&
    typeof v.name === "string"
  );
}

// ─── Singleton script loader ──────────────────────────────────────────────────
let rzpScriptPromise: Promise<void> | null = null;

function ensureRazorpayLoaded(): Promise<void> {
  if (rzpScriptPromise !== null) return rzpScriptPromise;

  rzpScriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("SDK must be loaded in a browser context"));
      return;
    }
    if (typeof window.Razorpay === "function") {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (typeof window.Razorpay !== "function") {
        rzpScriptPromise = null;
        reject(new Error("Payment SDK loaded but unavailable"));
        return;
      }
      resolve();
    };
    script.onerror = () => {
      rzpScriptPromise = null;
      reject(new Error("Failed to load payment SDK. Check your connection."));
    };
    document.body.appendChild(script);
  });

  return rzpScriptPromise;
}

// ─── Framer variants ──────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08 },
  }),
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false); // prevents duplicate submissions

  // Resets UI state – called on modal dismiss or when aborting checkout
  const resetLoadingState = () => {
    setLoading(false);
    inFlight.current = false;
  };

  async function handleUpgrade(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);

    let modalOpened = false; // ensures finally doesn't interfere with open modal

    try {
      await ensureRazorpayLoaded();

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        setError("Unable to start checkout. Please try again.");
        return;
      }

      const raw: unknown = await res.json();
      if (!isCheckoutPayload(raw)) {
        console.error("[checkout] Unexpected payload shape:", raw);
        setError("Received an invalid response. Please contact support.");
        return;
      }

      const rzp = new window.Razorpay({
        key: raw.key,
        subscription_id: raw.subscription_id,
        name: "CodeAutopsy",
        description: "Specialist Plan — $2 / month",
        prefill: { name: raw.name, email: raw.email },
        theme: { color: "#ffffff" },
        handler: () => {
          // Payment success – redirect to confirmation page.
          // Access is granted only after server‑side webhook verification.
          router.push("/?upgraded=true");
        },
        modal: {
          ondismiss: resetLoadingState,
          escape: false,
        },
      });

      rzp.open();
      modalOpened = true; // prevent finally from prematurely resetting state
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      // Only reset if the modal was never opened (error during setup / redirect)
      if (!modalOpened) {
        resetLoadingState();
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-300 py-24 px-6 font-satoshi">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial="hidden"
          animate="show"
          custom={0}
          variants={fadeUp}
          className="mb-20"
        >
          <Link
            href="/"
            className="inline-block text-slate-600 hover:text-slate-300 text-xs font-semibold uppercase tracking-widest transition-colors mb-10"
          >
            ← Back to Home
          </Link>
          <div className="border-t border-white/5 pt-10">
            <h1 className="cabinet text-6xl md:text-8xl font-bold text-white tracking-tighter italic uppercase leading-none">
              Pricing
            </h1>
            <p className="text-slate-500 text-sm mt-4 max-w-xs leading-relaxed">
              Pick the precision level for your codebase dissection.
            </p>
          </div>
        </motion.div>

        {/* Error banner */}
        {error !== null && (
          <div
            role="alert"
            className="mb-6 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-xs"
          >
            {error}
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          {/* Intern */}
          <motion.div
            initial="hidden"
            animate="show"
            custom={1}
            variants={fadeUp}
            className="bg-[#0a0a0a] p-8 flex flex-col justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-6">
                Intern
              </p>
              <div className="mb-8">
                <span className="text-5xl font-black text-white tracking-tighter">
                  $0
                </span>
                <span className="text-slate-600 text-sm ml-1">/forever</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-center gap-3">
                  <FaCheck className="w-2.5 shrink-0 text-slate-600" />
                  10 autopsies / day
                </li>
                <li className="flex items-center gap-3">
                  <FaCheck className="w-2.5 shrink-0 text-slate-600" />
                  Llama-3.3 70B engine
                </li>
                <li className="flex items-center gap-3">
                  <FaCheck className="w-2.5 shrink-0 text-slate-600" />
                  Basic architecture maps
                </li>
              </ul>
            </div>
            <Link
              href="/"
              className="mt-10 block text-center py-2.5 rounded-lg border border-white/[0.08] text-slate-500 font-semibold text-xs uppercase tracking-widest hover:border-white/[0.15] hover:text-slate-300 transition-all"
            >
              Get Started
            </Link>
          </motion.div>

          {/* Specialist */}
          <motion.div
            initial="hidden"
            animate="show"
            custom={2}
            variants={fadeUp}
            className="bg-[#0e0e0e] p-8 flex flex-col justify-between relative"
          >
            <div className="absolute top-0 left-8 right-8 h-px bg-white/20" />
            <div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-white">
                  Specialist
                </p>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 border border-white/10 px-2 py-0.5 rounded">
                  Early Access
                </span>
              </div>
              <div className="mb-1">
                <span className="text-5xl font-black text-white tracking-tighter">
                  $2
                </span>
                <span className="text-slate-600 text-sm ml-1">/mo</span>
              </div>
              <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest mb-8">
                Launch price · Lock in forever
              </p>
              <ul className="space-y-3 text-sm text-slate-400">
                {[
                  "100 autopsies / day",
                  "Private repositories",
                  "Advanced model routing",
                  "Markdown exports",
                  "Priority analysis queue",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <FaCheck className="w-2.5 shrink-0 text-white" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                void handleUpgrade();
              }}
              disabled={loading}
              aria-busy={loading}
              className="mt-10 w-full py-2.5 rounded-lg bg-white text-[#0a0a0a] font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Loading..." : "Upgrade to Specialist"}
            </motion.button>
          </motion.div>

          {/* Chief Surgeon */}
          <motion.div
            initial="hidden"
            animate="show"
            custom={3}
            variants={fadeUp}
            className="bg-[#0a0a0a] p-8 flex flex-col justify-between opacity-40 cursor-not-allowed select-none"
            aria-disabled="true"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 italic">
                  Chief Surgeon
                </p>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 border border-white/5 px-2 py-0.5 rounded">
                  Coming Soon
                </span>
              </div>
              <div className="mb-8">
                <span className="text-2xl font-black text-slate-500 tracking-tighter uppercase italic">
                  Custom
                </span>
              </div>
              <ul className="space-y-3 text-sm text-slate-700">
                {[
                  "Unlimited analysis",
                  "Team collaboration",
                  "Custom AI models",
                  "Workflow integrations",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <FaLock className="w-2.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <button
              disabled
              aria-disabled="true"
              className="mt-10 w-full py-2.5 rounded-lg border border-white/5 text-slate-700 font-semibold text-xs uppercase tracking-widest cursor-not-allowed"
            >
              Waitlist
            </button>
          </motion.div>
        </div>

        <motion.p
          initial="hidden"
          animate="show"
          custom={4}
          variants={fadeUp}
          className="text-center text-slate-700 text-xs mt-8"
        >
          Cancel anytime. No hidden fees. Billed monthly via Razorpay.
        </motion.p>
      </div>
    </div>
  );
}
