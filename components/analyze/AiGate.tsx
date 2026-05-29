"use client";

import { motion } from "framer-motion";
import { Zap, Sparkles } from "lucide-react";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { createClient } from "@/lib/supabase-browser";
import { useCallback } from "react";
import { AI_FREE_LIMIT } from "@/lib/ai-usage";

interface AiGateProps {
  state: "auth_required" | "limit_reached";
  repoUrl?: string;
}

export default function AiGate({ state, repoUrl }: AiGateProps) {
  const handleGitHubLogin = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "user:email",
        redirectTo: `${window.location.origin}/analyze?repo=${encodeURIComponent(repoUrl ?? "")}`,
      },
    });
  }, [repoUrl]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex items-center justify-center"
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 backdrop-blur-md bg-[#0a0a0a]/60" />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 340,
          damping: 28,
          delay: 0.05,
        }}
        className="relative z-10 w-full max-w-sm mx-4 bg-[#111]/90 border border-white/10 rounded-2xl p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] flex flex-col items-center gap-5 text-center"
      >
        {state === "auth_required" ? (
          <>
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <SiGithub className="w-5 h-5 text-slate-300" />
            </div>

            {/* Copy */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold text-white tracking-tight">
                Unlock AI Insights
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Get {AI_FREE_LIMIT} free AI architectural analyses. Sign in with
                GitHub — no credit card needed.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Architecture Summary",
                "Risk Detection",
                "Code Health Score",
              ].map((f) => (
                <span
                  key={f}
                  className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400"
                >
                  {f}
                </span>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleGitHubLogin}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white text-black font-bold text-sm hover:bg-slate-100 transition-colors shadow-lg"
            >
              <SiGithub className="w-4 h-4" />
              Continue with GitHub
            </button>

            <p className="text-[10px] text-slate-600 font-mono">
              Free forever · No spam · Open source
            </p>
          </>
        ) : (
          <>
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>

            {/* Copy */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold text-white tracking-tight">
                You&apos;ve used your {AI_FREE_LIMIT} free analyses
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upgrade to Pro for unlimited AI insights, or plug in your own
                Gemini API key to keep going for free.
              </p>
            </div>

            {/* CTA — Pro (placeholder) */}
            <button
              disabled
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm opacity-80 cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade to Pro — Coming Soon
            </button>

            {/* CTA — Own key (placeholder) */}
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/10 text-slate-400 text-xs font-mono hover:border-white/20 transition-colors cursor-not-allowed"
            >
              Use my own API key — Coming Soon
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
