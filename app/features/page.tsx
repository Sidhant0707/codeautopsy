'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaProjectDiagram, FaBrain, FaDatabase, FaCodeBranch, FaBolt, FaShieldAlt } from 'react-icons/fa';

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EXPO_OUT } },
};

export default function FeaturesPage() {
  const coreFeatures = [
    {
      icon: FaBrain,
      title: "AI Autopsy Engine",
      status: "Live",
      desc: "Powered by Gemini 2.0 Flash. We strip away repository noise and feed only the highest-scoring core files into our semantic analysis engine for deep architectural breakdown."
    },
    {
      icon: FaProjectDiagram,
      title: "Dependency Mapping",
      status: "Live",
      desc: "Dynamic generation of interactive Mermaid.js diagrams. Visually map the execution flow from your HTML/JS entry points down to utility modules."
    },
    {
      icon: FaDatabase,
      title: "Global Caching Network",
      status: "Live",
      desc: "Built on Supabase. Analyze a repository once, and the results are cached globally for lightning-fast, zero-quota retrieval on subsequent runs."
    },
    {
      icon: FaCodeBranch,
      title: "Smart File Scoring",
      status: "Live",
      desc: "Our custom heuristic parser scores files based on their Fan-In and role, automatically filtering out node_modules, minified assets, and boilerplate config."
    }
  ];

  const upcomingFeatures = [
    { icon: FaBolt, title: "Real-time GitHub Webhooks", text: "Auto-analyze every new commit pushed to your main branch." },
    { icon: FaShieldAlt, title: "Private Repositories", text: "Secure OAuth integration to dissect your private company codebases." }
  ];

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-slate-300 py-24 px-6 relative overflow-hidden">
      
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/[0.01] blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="mb-20">
          <Link href="/" className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            ← Back to Home
          </Link>
          <h1 className="text-5xl md:text-7xl font-bold text-white mt-8 mb-6 tracking-tighter italic uppercase">
            The Anatomy <br />Of Code.
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
            We don&apos;t just read repositories; we dissect them. CodeAutopsy combines heuristic static analysis with state-of-the-art LLMs to map, score, and explain complex software architectures.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24">
          {coreFeatures.map((box, i) => (
            <motion.div 
              key={i}
              variants={fadeUp}
              className="glass-card p-8 rounded-2xl border border-white/5 opacity-60 hover:opacity-100 transition-opacity"
            >
              <div className="flex justify-between items-start mb-6">
                <box.icon className="text-white text-2xl" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-1 rounded">
                  {box.status}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{box.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {box.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div variants={fadeUp} className="mb-24">
          <h2 className="text-2xl font-bold text-white mb-8 uppercase tracking-tighter italic border-b border-white/5 pb-4">
            In The Pipeline
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {upcomingFeatures.map((feat, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <feat.icon className="text-slate-500 mb-4 text-xl" />
                <h4 className="text-white font-bold mb-2">{feat.title}</h4>
                <p className="text-sm text-slate-500">{feat.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          variants={fadeUp} 
          className="p-12 rounded-3xl bg-gradient-to-br from-[#141414] to-transparent border border-white/5 text-center"
        >
          <h3 className="text-2xl font-bold text-white mb-4 italic tracking-tighter">Ready to operate?</h3>
          <p className="text-slate-500 text-sm mb-8 max-w-md mx-auto">
            Stop reading documentation. Start dissecting architecture. Drop a repository link into the engine and see it for yourself.
          </p>
          <Link 
            href="/"
            className="inline-block px-8 py-3 rounded-full bg-white text-black font-bold text-xs uppercase tracking-[0.2em] hover:scale-105 transition-transform active:scale-95 text-center"
          >
            Launch Engine
          </Link>
        </motion.div>
      </div>
    </div>
  );
}