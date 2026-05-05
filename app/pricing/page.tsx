"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaCheck, FaLock } from "react-icons/fa";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-slate-300 py-24 px-6 relative overflow-hidden font-satoshi">
      {}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-white/[0.02] blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="text-center mb-20"
        >
          <Link
            href="/"
            className="cursor-pointer text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            ← Back to Home
          </Link>
          <h1 className="cabinet text-5xl md:text-7xl font-bold text-white mt-8 mb-4 tracking-tighter italic uppercase">
            Pricing
          </h1>
          <p className="text-slate-500 text-lg">
            Pick the precision level for your codebase dissection.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col justify-between bg-[#141414]"
          >
            <div>
              <h3 className="cabinet text-white font-bold text-xl mb-2">
                Student
              </h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-black text-white">$0</span>
                <span className="text-slate-500 text-sm">/forever</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <FaCheck className="text-slate-500 w-3" /> 10 Autopsies / day
                </li>
                <li className="flex items-center gap-2">
                  <FaCheck className="text-slate-500 w-3" /> Llama-3.3 70B
                  Engine
                </li>
                <li className="flex items-center gap-2">
                  <FaCheck className="text-slate-500 w-3" /> Basic Architecture
                  Maps
                </li>
              </ul>
            </div>
            <Link
              href="/"
              className="cursor-pointer block text-center py-3 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform active:scale-95"
            >
              Get Started
            </Link>
          </motion.div>

          {}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="glass-card p-8 rounded-3xl border border-white/5 opacity-60 relative group cursor-not-allowed flex flex-col justify-between bg-[#141414]"
          >
            <div className="absolute top-4 right-4 px-2 py-1 rounded bg-slate-800 border border-white/10">
              <span className="text-[9px] font-black text-white uppercase tracking-widest">
                Coming Soon
              </span>
            </div>
            <div>
              <h3 className="cabinet text-slate-400 font-bold text-xl mb-2 italic">
                Architect
              </h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-black text-slate-500">$19</span>
                <span className="text-slate-600 text-sm">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <FaLock className="w-3" /> Private Repositories
                </li>
                <li className="flex items-center gap-2">
                  <FaLock className="w-3" /> Priority Llama-3.3 Access
                </li>
                <li className="flex items-center gap-2">
                  <FaLock className="w-3" /> Export to Markdown
                </li>
              </ul>
            </div>
            <button
              disabled
              className="w-full py-3 rounded-xl bg-white/5 text-slate-600 font-bold text-xs uppercase tracking-widest cursor-not-allowed"
            >
              Locked
            </button>
          </motion.div>

          {}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="glass-card p-8 rounded-3xl border border-white/5 opacity-60 relative cursor-not-allowed flex flex-col justify-between bg-[#141414]"
          >
            <div className="absolute top-4 right-4 px-2 py-1 rounded bg-slate-800 border border-white/10">
              <span className="text-[9px] font-black text-white uppercase tracking-widest">
                Coming Soon
              </span>
            </div>
            <div>
              <h3 className="cabinet text-slate-400 font-bold text-xl mb-2 italic">
                Surgical
              </h3>
              <div className="flex items-baseline gap-1 mb-8 text-slate-400">
                <span className="text-xl font-black text-slate-500 italic uppercase tracking-tighter">
                  Custom
                </span>
              </div>
              <ul className="space-y-4 mb-8 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <FaLock className="w-3" /> Unlimited Analysis
                </li>
                <li className="flex items-center gap-2">
                  <FaLock className="w-3" /> Team Collaboration
                </li>
                <li className="flex items-center gap-2">
                  <FaLock className="w-3" /> Custom AI Models
                </li>
              </ul>
            </div>
            <button
              disabled
              className="w-full py-3 rounded-xl bg-white/5 text-slate-600 font-bold text-xs uppercase tracking-widest cursor-not-allowed"
            >
              Waitlist
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
