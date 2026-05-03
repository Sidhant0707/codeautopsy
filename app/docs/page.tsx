'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  FaBook, 
  FaMicroscope, 
  FaCodeBranch, 
  FaTerminal, 
  FaShieldAlt,
  FaLightbulb 
} from 'react-icons/fa';

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EXPO_OUT } },
};

export default function DocsPage() {
  const sections = [
    {
      icon: FaMicroscope,
      title: "How It Works",
      content: "CodeAutopsy doesn't just read code; it performs a structural analysis. Our engine fetches the repository via the GitHub API and uses a heuristic parser to identify the 'vital organs'—entry points, routers, and configuration files—to provide context within LLM token limits."
    },
    {
      icon: FaCodeBranch,
      title: "Heuristic Scoring",
      content: "We use a proprietary scoring algorithm to rank files. Files with high 'Fan-in' (referenced by many other files) or specific naming conventions (e.g., App.tsx, index.js, main.py) are prioritized for AI analysis to ensure 80% architectural clarity from 20% of the code."
    },
    {
      icon: FaTerminal,
      title: "API Usage",
      content: "For every analysis, the tool maps dependencies and constructs a system prompt for Gemini 1.5 Flash. This allows for rapid-fire responses regarding execution flow and logic bottlenecks."
    },
    {
      icon: FaShieldAlt,
      title: "Security & Privacy",
      content: "Your code is never stored on our servers. We fetch the contents, process them in memory for the AI context, and then discard them. Only the resulting JSON analysis is cached in Supabase for performance."
    }
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#0e0e0e] text-slate-300 py-24 px-6">
      
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
        <div className="absolute top-[5%] left-[20%] w-[30%] h-[30%] bg-white/[0.02] blur-[120px] rounded-full" />
      </div>

      <motion.div 
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto relative z-10"
      >
        <motion.div variants={fadeUp} className="mb-12">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-white/[0.08] hover:text-white transition-all">
            ← Back to Home
          </Link>
        </motion.div>

        <motion.div variants={fadeUp} className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#141414] border border-white/5 flex items-center justify-center text-slate-100">
            <FaBook className="text-xl" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white italic uppercase">
            Documentation
          </h1>
        </motion.div>

        <motion.p variants={fadeUp} className="text-lg text-slate-400 mb-16 max-w-2xl leading-relaxed">
          A deep dive into the engineering principles behind the world&apos;s first AI-powered codebase visualization tool.
        </motion.p>

        {/* Documentation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {sections.map((section, i) => (
            <motion.div 
              key={i} 
              variants={fadeUp} 
              className="glass-card p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-all group"
            >
              <section.icon className="text-2xl text-slate-500 mb-6 group-hover:text-slate-200 transition-colors" />
              <h3 className="text-xl font-bold text-white mb-4">{section.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500 group-hover:text-slate-400 transition-colors">
                {section.content}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Pro Tip Section */}
        <motion.div 
          variants={fadeUp} 
          className="p-8 rounded-3xl bg-gradient-to-br from-[#141414] to-[#0a0a0a] border border-white/5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <FaLightbulb size={120} />
          </div>
          <div className="relative z-10">
            <h4 className="text-white font-bold mb-2 flex items-center gap-2">
              <FaLightbulb className="text-slate-400" />
              Pro Tip for Developers
            </h4>
            <p className="text-slate-500 text-sm max-w-xl">
              To get the most out of CodeAutopsy, ensure your repository has a clear <code className="text-slate-300">README.md</code> and standard naming conventions. Our AI uses these signals to better understand your architectural intent.
            </p>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}