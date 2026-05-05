'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaRocket, FaBug, FaMagic, FaShieldAlt } from 'react-icons/fa';

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EXPO_OUT } },
};

export default function ChangelogPage() {
  const updates = [
    {
      version: "v1.2.0",
      date: "April 2026",
      title: "The Polish Update",
      description: "Complete UI overhaul and supplementary page rollout.",
      changes: [
        { type: "Added", text: "New high-vibrance 'About', 'Docs', and 'Contact' pages.", icon: FaMagic },
        { type: "Added", text: "Global Navigation Header with Auth-aware state.", icon: FaShieldAlt },
        { type: "Fixed", text: "Resolved Hydration Mismatch warnings in concurrent rendering.", icon: FaBug },
      ]
    },
    {
      version: "v1.1.0",
      date: "March 2026",
      title: "Engine Optimization",
      description: "Major backend refactor to handle larger repositories and prevent API rate-limiting.",
      changes: [
        { type: "Improved", text: "Parallelized file fetching using Promise.all (70% faster).", icon: FaRocket },
        { type: "Added", text: "Supabase caching layer to serve instant results for known repos.", icon: FaMagic },
        { type: "Fixed", text: "Implemented token-trimming logic to eliminate 429 Rate Limit errors.", icon: FaBug },
      ]
    },
    {
      version: "v1.0.0",
      date: "February 2026",
      title: "Initial Launch",
      description: "The birth of CodeAutopsy. Core analysis engine is live.",
      changes: [
        { type: "Added", text: "GitHub & Google OAuth integration via Supabase.", icon: FaShieldAlt },
        { type: "Added", text: "AI-powered architectural scoring and summarization.", icon: FaRocket },
        { type: "Added", text: "Interactive analysis history dashboard.", icon: FaMagic },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-slate-300 py-24 px-6 relative overflow-hidden">
      
      {}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/[0.02] blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="mb-16">
          <Link href="/" className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            ← Back to Home
          </Link>
          <h1 className="text-5xl md:text-7xl font-bold text-white mt-8 mb-4 tracking-tighter italic uppercase">
            Changelog
          </h1>
          <p className="text-slate-500 text-lg">Tracking the evolution of CodeAutopsy.</p>
        </motion.div>

        <div className="relative border-l border-white/5 ml-4 md:ml-0">
          {updates.map((update, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="mb-20 ml-8 relative"
            >
              {}
              <div className="absolute -left-[41px] top-1.5 w-5 h-5 rounded-full bg-[#0e0e0e] border-2 border-white/10" />
              
              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
                <span className="text-xs font-bold font-mono text-slate-500 bg-white/5 px-2 py-1 rounded w-fit">
                  {update.version}
                </span>
                <span className="text-xs text-slate-600 font-medium uppercase tracking-widest">
                  {update.date}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-slate-100 mb-2">{update.title}</h2>
              <p className="text-slate-500 mb-8 max-w-xl">{update.description}</p>

              <div className="space-y-4">
                {update.changes.map((change, cIdx) => (
                  <div key={cIdx} className="flex items-start gap-4 group">
                    <div className="mt-1 w-8 h-8 rounded-lg bg-[#141414] border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-slate-200 transition-colors">
                      <change.icon size={12} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 block mb-0.5">
                        {change.type}
                      </span>
                      <p className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                        {change.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}