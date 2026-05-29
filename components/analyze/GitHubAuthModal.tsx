"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { FaGithub } from "react-icons/fa";

interface GitHubAuthModalProps {
  onLogin: () => Promise<void>;
}

export default function GitHubAuthModal({ onLogin }: GitHubAuthModalProps) {
  const router = useRouter();

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative font-satoshi p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 glass-card p-8 rounded-2xl max-w-md w-full border-2 border-white/10 bg-[#0e0e0e]"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center mb-6">
          <FaGithub className="w-8 h-8 text-white" />
        </div>

        <h2 className="cabinet text-2xl font-bold text-white mb-3 text-center">
          Private Repository
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-8 text-center">
          To analyze private code, you need to authenticate with GitHub.
        </p>

        <div className="space-y-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onLogin}
            className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-3"
          >
            <FaGithub className="w-5 h-5" /> Connect GitHub Account
          </motion.button>
          <button
            onClick={() => router.push("/")}
            className="w-full px-6 py-4 rounded-xl border border-white/10 font-bold text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}
