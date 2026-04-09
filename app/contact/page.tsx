'use client';

import React from 'react';
import Link from 'next/link';
import { FaTwitter, FaLinkedin, FaEnvelope } from 'react-icons/fa';
import { motion } from 'framer-motion';

const EXPO_OUT = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EXPO_OUT },
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen relative overflow-x-hidden bg-gradient-to-b from-[#0e0e0e] via-[#0e0e0e] to-[#1a1a1a] flex items-center justify-center py-24 px-6">
      
      {/* Ambient Background Glows (Same as Landing Page) */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: EXPO_OUT }}
          className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: EXPO_OUT, delay: 0.2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full"
        />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="max-w-3xl w-full text-center relative z-10"
      >
        <motion.div variants={fadeUp} className="mb-12">
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.03] border border-white/10 text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-white/[0.08] hover:text-white transition-all hover:border-white/20">
            ← Back to Home
          </Link>
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-[1.1] text-slate-50">
          Let's{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-300 to-slate-500">
            Connect.
          </span>
        </motion.h1>

        <motion.p variants={fadeUp} className="text-lg md:text-xl text-slate-400 mb-14 max-w-lg mx-auto leading-relaxed">
          Have a question about the AI analysis, need custom enterprise limits, or just want to chat about code?
        </motion.p>

        <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          
          {/* Main Email Card */}
          <div className="glass-card p-8 rounded-2xl border border-white/5 hover:bg-white/[0.02] hover:border-white/20 transition-all duration-300 group md:col-span-2 relative overflow-hidden premium-shadow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.01] rounded-bl-full pointer-events-none group-hover:bg-white/[0.03] transition-colors duration-500" />
            <div className="w-12 h-12 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-center text-slate-400 mb-6 group-hover:text-white transition-colors duration-300">
              <FaEnvelope className="w-5 h-5" />
            </div>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-2">Direct Email</p>
            {/* Swap with your actual email */}
            <a href="mailto:sidhantkumar0707@gmail.com" className="text-2xl md:text-3xl font-bold text-slate-200 group-hover:text-white transition-colors duration-300">
              sidhantkumar0707@gmail.com
            </a>
          </div>

          {/* Twitter Card */}
          <a href="https://twitter.com/SiDHANT0707" target="_blank" rel="noopener noreferrer" className="glass-card p-8 rounded-2xl border border-white/5 hover:bg-white/[0.02] hover:border-white/20 transition-all duration-300 group flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center text-slate-400 mb-5 group-hover:text-slate-100 group-hover:border-slate-100/20 transition-all duration-300">
              <FaTwitter className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-slate-200 group-hover:text-white transition-colors duration-300">Twitter (X)</span>
            <span className="text-slate-500 text-sm mt-1">@SiDHANT0707</span>
          </a>

          {/* LinkedIn Card */}
          <a href="https://www.linkedin.com/in/sidhant07" target="_blank" rel="noopener noreferrer" className="glass-card p-8 rounded-2xl border border-white/5 hover:bg-white/[0.02] hover:border-white/20 transition-all duration-300 group flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center text-slate-400 mb-5 group-hover:text-slate-100 group-hover:border-slate-100/20 transition-all duration-300">
              <FaLinkedin className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-slate-200 group-hover:text-white transition-colors duration-300">LinkedIn</span>
            <span className="text-slate-500 text-sm mt-1">/in/sidhant07</span>
          </a>

        </motion.div>
      </motion.div>
    </div>
  );
}