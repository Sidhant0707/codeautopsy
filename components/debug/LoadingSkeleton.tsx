"use client";

import { motion } from "framer-motion";

export function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-white/5 rounded w-48 animate-pulse" />
          <div className="h-4 bg-white/5 rounded w-32 animate-pulse" />
        </div>
      </div>

      {}
      <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent"
          />
          <span className="text-sm text-slate-400">Analyzing crash location...</span>
        </div>
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 0.3 }}
            className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent"
          />
          <span className="text-sm text-slate-400">Traversing dependency graph...</span>
        </div>
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 0.6 }}
            className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent"
          />
          <span className="text-sm text-slate-400">Generating diagnosis...</span>
        </div>
      </div>

      {}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="h-4 bg-white/5 rounded w-1/4 animate-pulse" />
            <div className="h-3 bg-white/5 rounded w-full animate-pulse" />
            <div className="h-3 bg-white/5 rounded w-5/6 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}