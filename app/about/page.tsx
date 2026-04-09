'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaGithub, FaLinkedin, FaCode, FaLightbulb, FaRocket } from 'react-icons/fa';

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EXPO_OUT } },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen relative overflow-x-hidden bg-gradient-to-b from-[#0e0e0e] via-[#0e0e0e] to-[#1a1a1a] py-24 px-6">
      
      {/* Background Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] left-[-10%] w-[35%] h-[35%] bg-white/[0.01] blur-[100px] rounded-full" />
      </div>

      <motion.div 
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto relative z-10"
      >
        <motion.div variants={fadeUp} className="mb-12 text-center">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-white/[0.08] hover:text-white transition-all">
            ← Back to Home
          </Link>
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-bold mb-8 tracking-tight text-center text-slate-50">
          The Story Behind <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-400 to-slate-600 uppercase italic">
            CodeAutopsy
          </span>
        </motion.h1>

        <motion.div variants={fadeUp} className="glass-card p-10 rounded-3xl border border-white/5 mb-16 leading-relaxed text-slate-300 space-y-6">
          <p className="text-xl text-slate-100 font-medium">
            CodeAutopsy started with a simple problem: Codebases are getting bigger, but our time isn't.
          </p>
          <p>
            As a Computer Science student specializing in Data Science at **GL Bajaj Institute of Technology and Management**, I found myself constantly diving into massive GitHub repositories to learn. The friction was always the same—spending hours just trying to find the "entry point" or understanding how data flows from a UI component to the database.
          </p>
          <p>
            I built CodeAutopsy to act as a **Precision Surgical Tool** for developers. Instead of reading thousands of files, our AI-driven engine performs a "post-mortem" on a repo, identifying the vital organs (core modules) and mapping the nervous system (dependencies) in seconds.
          </p>
        </motion.div>

        {/* Vision Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            { icon: FaCode, title: "Code", desc: "Built with Next.js, TypeScript, and Supabase for a seamless full-stack experience." },
            { icon: FaLightbulb, title: "Build", desc: "Utilizing Gemini 1.5 Flash to provide high-speed architectural insights." },
            { icon: FaRocket, title: "Innovate", desc: "Designed to help students and engineers contribute to OSS faster than ever." }
          ].map((item, i) => (
            <motion.div key={i} variants={fadeUp} className="glass-card p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
              <item.icon className="text-2xl text-slate-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Founder Section */}
        <motion.div variants={fadeUp} className="border-t border-white/5 pt-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-12 italic uppercase tracking-tighter">
            The Founder
          </h2>
          
          <div className="flex flex-col items-center group">
            {/* Avatar Container with Pulse Effect */}
            <div className="relative mb-8">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-slate-500 via-slate-100 to-slate-600 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-300 animate-pulse"></div>
              
              <div className="relative w-32 h-32 rounded-full bg-[#0a0a0a] border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl group-hover:border-white/20 transition-all duration-500">
                <div className="flex items-center gap-1 font-mono">
                  <span className="text-slate-600 text-xl font-light opacity-40 group-hover:opacity-100 transition-opacity">
                    {`{`}
                  </span>
                  <span className="text-3xl font-black text-white tracking-tighter transition-all duration-500 group-hover:tracking-[0.1em] group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-500">
                    SID
                  </span>
                  <span className="text-slate-600 text-xl font-light opacity-40 group-hover:opacity-100 transition-opacity">
                    {`}`}
                  </span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.03] to-transparent w-full h-[20%] -translate-y-full group-hover:animate-scan pointer-events-none" />
              </div>
            </div>

            {/* Bio Info */}
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white tracking-tight">Sidhant Kumar</h3>
              <p className="text-slate-500 uppercase tracking-[0.2em] text-[10px] font-black bg-white/5 px-3 py-1 rounded-full inline-block">
                B.Tech CSDS • GL Bajaj
              </p>
              <p className="text-slate-400 text-sm max-w-sm mt-4 mx-auto leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                Full-stack engineer specializing in AI-driven dev tools and codebase architecture.
              </p>
            </div>
            
            {/* Social Links */}
            <div className="flex gap-4 mt-8">
              <a href="https://github.com/Sidhant0707" target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-[#141414] border border-white/5 text-slate-500 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all duration-300 transform hover:-translate-y-1">
                <FaGithub className="w-5 h-5" />
              </a>
              <a href="https://www.linkedin.com/in/sidhant07" target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-[#141414] border border-white/5 text-slate-500 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all duration-300 transform hover:-translate-y-1">
                <FaLinkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}