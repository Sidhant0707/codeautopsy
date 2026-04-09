'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaCode, FaBrain, FaRocket, FaTerminal, FaUsers } from 'react-icons/fa';

const EXPO_OUT = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EXPO_OUT } },
};

export default function CareersPage() {
  const roles = [
    {
      title: "AI Engineer",
      type: "Full-time / Remote",
      level: "Senior",
      desc: "Optimize our heuristic scoring and LLM prompt engineering for Gemini 1.5 Pro integration."
    },
    {
      title: "Frontend Architect",
      type: "Full-time",
      level: "Mid-Senior",
      desc: "Lead the development of our interactive codebase visualization and 3D dependency maps."
    },
    {
      title: "Open Source Advocate",
      type: "Part-time / Contract",
      level: "Junior-Mid",
      desc: "Engage with the OSS community and build 'Autopsy' profiles for the world's top 1000 repos."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-slate-300 py-24 px-6 relative overflow-hidden">
      
      {/* Ambient background light */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/[0.01] blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="mb-20">
          <Link href="/" className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            ← Back to Home
          </Link>
          <h1 className="text-5xl md:text-7xl font-bold text-white mt-8 mb-6 tracking-tighter italic uppercase">
            Join the <br />Dissection.
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
            We are building tools that help developers understand code at the speed of thought. 
            No more manual browsing. No more onboarding friction.
          </p>
        </motion.div>

        {/* Perks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {[
            { icon: FaTerminal, title: "Pure Dev Focus", text: "Zero meetings. 100% focused on shipping code that matters." },
            { icon: FaBrain, title: "AI-First Culture", text: "Experiment with the latest LLM architectures every single day." },
            { icon: FaUsers, title: "Remote Native", text: "Work from anywhere in the world. We value output over hours." }
          ].map((perk, i) => (
            <motion.div key={i} variants={fadeUp} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <perk.icon className="text-slate-500 mb-4 text-xl" />
              <h4 className="text-white font-bold mb-2">{perk.title}</h4>
              <p className="text-sm text-slate-500">{perk.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Stealth Mode / Future Positions */}
        <div className="space-y-12">
          <motion.div variants={fadeUp} className="text-center py-12 border-y border-white/5">
            <h2 className="text-2xl font-bold text-white mb-4 uppercase tracking-tighter italic">Currently in Stealth</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              CodeAutopsy is currently in a high-growth development phase. We are focusing on core architecture and user-market fit before expanding the surgical team.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { 
                title: "Engineering", 
                status: "Opening Q3 2026", 
                desc: "Focusing on Rust-based parsers and advanced AST visualization engines." 
              },
              { 
                title: "Growth & Community", 
                status: "Opening Q4 2026", 
                desc: "Building the world's largest library of open-source architectural 'Autopsies'." 
              }
            ].map((box, i) => (
              <motion.div 
                key={i}
                variants={fadeUp}
                className="glass-card p-8 rounded-2xl border border-white/5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-white">{box.title}</h3>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-1 rounded">
                    {box.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {box.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Talent Pool Call to Action */}
          <motion.div 
            variants={fadeUp} 
            className="p-10 rounded-3xl bg-gradient-to-br from-[#141414] to-transparent border border-white/5 text-center"
          >
            <h3 className="text-xl font-bold text-white mb-4">Get on the Radar</h3>
            <p className="text-slate-500 text-sm mb-8 max-w-md mx-auto">
              We don't hire often, but when we do, we look at our internal talent pool first. Send your GitHub/Portfolio to be notified when the doors open.
            </p>
            <Link 
  href="/contact"
  className="inline-block px-8 py-3 rounded-full bg-white text-black font-bold text-xs uppercase tracking-[0.2em] hover:scale-105 transition-transform active:scale-95 text-center"
>
  Join the Talent Pool
</Link>
          </motion.div>
        </div>

        {/* Footer Note */}
        <motion.div variants={fadeUp} className="mt-32 p-12 rounded-3xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 text-center">
          <h3 className="text-xl font-bold text-white mb-4 italic">Don't see a fit?</h3>
          <p className="text-slate-500 text-sm mb-8">
            We're always looking for talented hackers. Send your GitHub and a brief intro to sidhantkumar0707@gmail.com
          </p>
          <Link href="/contact" className="text-white text-xs font-bold uppercase tracking-[0.2em] border-b border-white/20 pb-1 hover:border-white transition-all">
            General Application →
          </Link>
        </motion.div>
      </div>
    </div>
  );
}