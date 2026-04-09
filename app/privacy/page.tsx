'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaShieldAlt, FaLock, FaEyeSlash, FaDatabase } from 'react-icons/fa';

const EXPO_OUT = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EXPO_OUT } },
};

export default function PrivacyPage() {
  const policies = [
    {
      icon: FaEyeSlash,
      title: "Zero Code Retention",
      text: "We do not store your source code. When you analyze a repository, the files are processed in-memory to generate the AI summary and then immediately discarded. We only cache the resulting analysis (JSON) to save you tokens on repeat visits."
    },
    {
      icon: FaLock,
      title: "OAuth Security",
      text: "We use Supabase and GitHub OAuth for authentication. CodeAutopsy never sees your GitHub password. We only request 'Read-only' access to public repositories unless you explicitly upgrade to a Pro plan for private repo analysis."
    },
    {
      icon: FaDatabase,
      title: "Data We Collect",
      text: "We collect your email address and basic profile info via GitHub to create your account. We also log the repository URLs you analyze to populate your 'History' dashboard. We never sell this data to third parties."
    },
    {
      icon: FaShieldAlt,
      title: "AI Processing",
      text: "Analysis is powered by Google Gemini 1.5 Flash. Only the code snippets required for architectural understanding are sent to the API. No personal data is included in these AI prompts."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-slate-300 py-24 px-6 relative overflow-hidden">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-white/[0.01] blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="mb-16">
          <Link href="/" className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            ← Back to Home
          </Link>
          <h1 className="text-5xl md:text-7xl font-bold text-white mt-8 mb-4 tracking-tighter italic uppercase">
            Privacy Policy
          </h1>
          <p className="text-slate-500 text-lg">Last updated: April 2026</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {policies.map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
            >
              <item.icon className="text-slate-500 mb-4 text-xl" />
              <h3 className="text-white font-bold text-lg mb-3">{item.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="border-t border-white/5 pt-12 text-center"
        >
          <p className="text-slate-600 text-sm italic">
            "We build for developers. We respect your code as if it were our own."
          </p>
          <div className="mt-8">
            <Link href="/contact" className="text-white text-xs font-bold uppercase tracking-widest hover:underline decoration-slate-500 underline-offset-4">
              Questions? Contact Support
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}