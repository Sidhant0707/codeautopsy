"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Activity } from "lucide-react";

interface DebugFormProps {
  onSubmit: (text: string) => void;
  isLoading?: boolean;
}

export function DebugForm({ onSubmit, isLoading }: DebugFormProps) {
  const [input, setInput] = useState("");

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="flex flex-col h-full w-full min-h-0"
    >
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Quick Test:</span>
        <button 
          type="button"
          onClick={() => setInput("TypeError: Cannot read properties of undefined (reading 'map')\n    at UserList (components/UserList.tsx:42:15)")} 
          className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-mono text-slate-400 transition-colors"
        >
          TypeError
        </button>
        <button 
          type="button"
          onClick={() => setInput("ReferenceError: window is not defined\n    at SSRRender (app/layout.tsx:12:5)")} 
          className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-mono text-slate-400 transition-colors"
        >
          ReferenceError
        </button>
      </div>

      <p className="text-sm text-slate-300 mb-3 font-satoshi flex-shrink-0">
        Paste your stack trace or error message
      </p>

      <textarea 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. TypeError: Cannot read properties of undefined..."
        className="w-full flex-1 min-h-[80px] overflow-y-auto resize-none bg-[#050505] border border-white/5 rounded-xl p-5 font-mono text-[13px] text-slate-300 focus:outline-none focus:border-white/20 transition-all custom-scrollbar shadow-inner mb-6"
      />

      <div className="mt-auto flex flex-col gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-amber-500/80 font-mono">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Include file paths and line numbers for best results</span>
        </div>
        
        <button 
          onClick={() => onSubmit(input)}
          disabled={!input.trim() || isLoading}
          className="w-full py-4 rounded-xl bg-slate-200 text-black font-bold text-xs uppercase tracking-[0.15em] hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
        >
          {isLoading ? (
            <>Initializing <Activity className="w-4 h-4 animate-pulse" /></>
          ) : (
            <>Initiate Diagnostics <Activity className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </motion.div>
  );
}