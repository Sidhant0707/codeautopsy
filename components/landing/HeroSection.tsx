"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { Bot, Activity, AlertCircle, Loader2 } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import ZipUploader from "@/components/ZipUploader";
import { getSystemTelemetry } from "@/app/actions/telemetry";
import {
  Counter,
  fadeIn,
  fadeUp,
  stagger,
} from "@/components/ui/landing-widgets";

export default function HeroSection() {
  const [repoUrl, setRepoUrl] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [maxLimit, setMaxLimit] = useState<number>(3);
  const router = useRouter();
  const [telemetry, setTelemetry] = useState({ successRate: 0, totalScans: 0 });
  const [repoError, setRepoError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const repoInputId = useId();

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    fetch("/api/limits", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setRemaining(data.remaining);
        setMaxLimit(data.maxTokens);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (!isMounted) return;
        setRemaining(3);
        setMaxLimit(3);
      });

    getSystemTelemetry()
      .then((data) => {
        if (!isMounted) return;
        setTelemetry(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("Telemetry fetch failed:", err);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const handleAnalyze = () => {
    if (isNavigating) return;
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      setRepoError("Please enter a GitHub repository URL");
      return;
    }
    if (!trimmed.startsWith("https://github.com/")) {
      setRepoError("URL must start with https://github.com/");
      return;
    }

    const parts = trimmed.replace("https://github.com/", "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      setRepoError(
        "Please enter a full repo URL like https://github.com/facebook/react",
      );
      return;
    }

    setRepoError(null);
    setIsNavigating(true);
    router.push(`/analyze?repo=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-4 sm:px-6 z-10">
      <div className="max-w-6xl mx-auto">
        <m.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="text-center"
        >
          <m.div
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-3 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-2"
          >
            <Bot className="h-4 w-4 text-slate-300" />
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-300">
              AI Code Intelligence
            </span>
          </m.div>

          {telemetry.totalScans > 0 && (
            <m.div variants={fadeIn} className="flex justify-center mb-8">
              <div className="inline-flex flex-wrap justify-center items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Live
                  </span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-white/[0.08]" />
                <div className="flex items-center gap-2">
                  <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 uppercase">
                    Accuracy
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
                    <Counter value={telemetry.successRate} />%
                  </span>
                </div>
                <div className="w-px h-4 bg-white/[0.08]" />
                <div className="flex items-center gap-2">
                  <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 uppercase">
                    Scans
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
                    <Counter value={telemetry.totalScans} />
                  </span>
                </div>
              </div>
            </m.div>
          )}

          <m.h1
            variants={fadeUp}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 sm:mb-8 tracking-tight leading-[1.1] sm:leading-[1.05]"
          >
            <span className="block text-slate-50 mb-1 sm:mb-2">
              Understand any codebase
            </span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-slate-400 to-slate-600">
              before it understands you.
            </span>
          </m.h1>

          <m.p
            variants={fadeUp}
            className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl lg:max-w-3xl mx-auto leading-relaxed mb-10 sm:mb-12 px-2"
          >
            CodeAutopsy turns unfamiliar repositories into architecture maps,
            dependency insights, execution flows, and prioritized engineering
            notes in minutes.
          </m.p>

          <m.div
            variants={fadeUp}
            className="max-w-3xl mx-auto mb-6 px-2 sm:px-0"
          >
            <label htmlFor={repoInputId} className="sr-only">
              GitHub repository URL
            </label>
            <div
              className="relative p-[1px] rounded-2xl bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-white/[0.08]"
              aria-busy={isNavigating}
            >
              <div className="flex flex-col sm:flex-row items-center bg-[#0a0a0a] rounded-2xl p-3 sm:p-4 gap-3">
                <div className="flex items-center w-full sm:flex-1 h-12 sm:h-auto border border-white/5 sm:border-none rounded-xl sm:rounded-none px-3 sm:px-0 bg-white/[0.02] sm:bg-transparent">
                  <FaGithub className="w-5 h-5 ml-1 sm:ml-2 text-slate-400 flex-shrink-0" />
                  <input
                    id={repoInputId}
                    type="text"
                    placeholder="https://github.com/facebook/react"
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      if (repoError) setRepoError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    disabled={isNavigating}
                    className="w-full bg-transparent border-none outline-none px-3 text-slate-200 placeholder:text-slate-600 font-mono text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-invalid={repoError ? "true" : "false"}
                  />
                </div>
                <m.button
                  onClick={handleAnalyze}
                  disabled={isNavigating}
                  whileHover={isNavigating ? undefined : { scale: 1.02 }}
                  whileTap={isNavigating ? undefined : { scale: 0.98 }}
                  className="w-full sm:w-auto px-8 py-3.5 sm:py-3 rounded-xl bg-white text-black font-bold text-sm transition-all shadow-lg hover:bg-slate-200 disabled:opacity-70 disabled:cursor-wait disabled:hover:bg-white flex items-center justify-center gap-2"
                >
                  {isNavigating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initializing uplink...</span>
                    </>
                  ) : (
                    <span>Analyze repo →</span>
                  )}
                </m.button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {repoError && (
                <m.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-mono">
                    {repoError}
                  </span>
                </m.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-center gap-2 sm:gap-3 mt-6 mb-4">
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${remaining === 0 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"} animate-pulse`}
              />
              <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em] truncate">
                {remaining !== null
                  ? `${remaining} / ${maxLimit} autopsies available`
                  : "Initializing..."}
              </span>
            </div>

            <p className="text-center text-slate-500 text-xs sm:text-sm flex flex-wrap justify-center gap-2">
              <span className="mt-0.5">Try:</span>
              {["vercel/next.js", "facebook/react", "expressjs/express"].map(
                (ex) => (
                  <button
                    key={ex}
                    disabled={isNavigating}
                    onClick={() => {
                      setRepoUrl(`https://github.com/${ex}`);
                      setRepoError(null);
                    }}
                    className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm font-mono hover:bg-white/[0.05] px-2 py-0.5 rounded disabled:opacity-50"
                  >
                    {ex}
                  </button>
                ),
              )}
            </p>
          </m.div>

          <m.div variants={fadeUp} className="mt-12 sm:mt-16 px-2 sm:px-0">
            <div className="flex items-center max-w-2xl mx-auto mb-6">
              <div className="flex-1 border-t border-white/[0.05]" />
              <span className="px-4 text-slate-600 text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em]">
                Or Local Code
              </span>
              <div className="flex-1 border-t border-white/[0.05]" />
            </div>
            <ZipUploader />
          </m.div>
        </m.div>
      </div>
    </section>
  );
}
