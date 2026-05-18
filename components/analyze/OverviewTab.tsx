"use client";

import { motion, Variants } from "framer-motion";
import {
  Layers,
  AlertTriangle,
  Cpu,
  Activity,
  Terminal,
  FileCode,
  ThumbsUp,
  GitMerge,
  CheckCircle2,
} from "lucide-react";
import { BadgeEmbed } from "@/components/BadgeEmbed";
import { RepoData } from "@/lib/types/analyze";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function OverviewTab({ data }: { data: RepoData }) {
  return (
    <motion.div
      role="tabpanel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      className="absolute inset-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar"
    >
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="max-w-5xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 pb-12"
      >
        {/* HEALTH STATUS SECTION */}
        <div className="xl:col-span-8">
          {data.analysis.health_status && (
            <div className="glass-card relative overflow-hidden p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#0e0e0e] h-full transition-all">
              <div
                className={`absolute -right-20 -top-20 w-64 h-64 blur-[100px] rounded-full opacity-20 pointer-events-none ${data.analysis.health_status.grade === "A" ? "bg-emerald-500" : data.analysis.health_status.grade === "B" ? "bg-blue-500" : data.analysis.health_status.grade === "C" ? "bg-amber-500" : data.analysis.health_status.grade === "D" ? "bg-orange-500" : "bg-red-500"}`}
              />
              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10 text-center md:text-left">
                <motion.div
                  whileHover={{
                    scale: 1.05,
                    rotateY: 15,
                    rotateX: -15,
                    boxShadow:
                      "0 20px 40px -10px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.1)",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  style={{
                    transformStyle: "preserve-3d",
                    perspective: 1000,
                    willChange: "transform",
                  }}
                  className={`flex-shrink-0 w-32 h-32 rounded-3xl flex flex-col items-center justify-center border-2 cursor-default shadow-[0_0_30px_rgba(0,0,0,0.5)] ${data.analysis.health_status.grade === "A" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : data.analysis.health_status.grade === "B" ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : data.analysis.health_status.grade === "C" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : data.analysis.health_status.grade === "D" ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}
                >
                  <motion.span
                    style={{ translateZ: 30 }}
                    className="text-6xl font-black cabinet leading-none tracking-tighter"
                  >
                    {data.analysis.health_status.grade}
                  </motion.span>
                  <motion.span
                    style={{ translateZ: 15 }}
                    className="text-xs font-mono font-bold uppercase tracking-widest mt-2 opacity-80"
                  >
                    {data.analysis.health_status.score} / 100
                  </motion.span>
                </motion.div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="cabinet text-2xl font-bold text-white mb-1">
                      {data.analysis.health_status.status}
                    </h2>
                    <p className="text-slate-400 text-sm">
                      Based on live coupling, circular dependencies, and file
                      bloat metrics.
                    </p>
                  </div>
                  <div className="pt-2 w-full flex justify-center md:justify-start">
                    <BadgeEmbed repoName={`${data.owner}/${data.repo}`} />
                  </div>
                  {data.analysis.health_status.refactor_plan && (
                    <div className="space-y-2 mt-4 text-left">
                      <h3 className="mono text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                        AI Refactoring Directives
                      </h3>
                      {data.analysis.health_status.refactor_plan.map(
                        (step, i) => (
                          <div
                            key={i}
                            className="flex gap-3 items-start p-3 rounded-xl bg-white/[0.02] border border-white/5"
                          >
                            <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="mono text-[9px] text-slate-400 font-bold">
                                {i + 1}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {step}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BLAST RADIUS & MODULES */}
        <div className="xl:col-span-4 h-full">
          <div className="glass-card p-6 rounded-2xl border border-white/10 bg-[#0e0e0e] h-full flex flex-col space-y-6">
            {data.analysis.blast_radius &&
              data.analysis.blast_radius.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500/80" />
                    <h2 className="mono text-[10px] font-bold uppercase tracking-widest text-amber-500/80">
                      Blast Radius
                    </h2>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {data.analysis.blast_radius.map((risk, i) => (
                      <div
                        key={i}
                        className="glass-card p-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.02]"
                      >
                        <code
                          className="mono text-[11px] text-amber-400/80 mb-2 block truncate"
                          title={risk.file}
                        >
                          {risk.file.split("/").pop()}
                        </code>
                        <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                          {risk.warning}
                        </p>
                        <div className="flex items-center gap-1.5 text-[9px] text-amber-500/60 font-mono uppercase">
                          <Layers className="w-3 h-3" /> {risk.dependents}{" "}
                          Dependent File(s)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <h2 className="mono text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
                Key Modules
              </h2>
              <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {data.analysis.key_modules.map((mod, i) => (
                  <div
                    key={i}
                    className="glass-card p-4 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <code
                        className="mono text-[11px] text-slate-300 truncate"
                        title={mod.file}
                      >
                        {mod.file.split("/").pop()}
                      </code>
                      <span className="text-[8px] uppercase tracking-widest font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                        {mod.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed border-l-2 border-white/10 pl-2">
                      {mod.why_it_exists}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SYSTEM PURPOSE & PULSE */}
        <div className="xl:col-span-8">
          <div className="glass-card relative overflow-hidden p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#0e0e0e] h-full flex flex-col group">
            <div className="relative z-10 flex-1 flex flex-col">
              <h2 className="cabinet text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" /> System Purpose
              </h2>
              <p className="text-slate-400 leading-relaxed text-sm mb-12">
                {data.analysis.what_it_does}
              </p>

              <div className="space-y-10">
                <div className="space-y-4">
                  <h3 className="mono text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 px-1">
                    <Cpu className="w-3 h-3" /> Core Tech Stack
                  </h3>
                  <div className="space-y-2">
                    {data.analysis.tech_stack &&
                      data.analysis.tech_stack.slice(0, 10).map((tech, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-6 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group/item"
                        >
                          <div className="w-32 shrink-0">
                            <span className="text-xs font-bold text-slate-200 group-hover/item:text-blue-400 transition-colors">
                              {tech.name}
                            </span>
                          </div>
                          <div className="h-4 w-px bg-white/10 hidden sm:block" />
                          <span className="text-[11px] text-slate-500 leading-tight flex-1">
                            {tech.purpose}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="mono text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 px-1">
                    <Activity className="w-3 h-3" /> Repository Pulse
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        label: "Primary Language",
                        value: data.language,
                        icon: Terminal,
                      },
                      {
                        label: "Project Complexity",
                        value: `${data.totalFiles} Source Files`,
                        icon: FileCode,
                      },
                      {
                        label: "Architecture Pattern",
                        value: data.analysis.architecture_pattern,
                        icon: Layers,
                      },
                      {
                        label: "Popularity / Stars",
                        value:
                          data.stars > 0
                            ? `${data.stars} Stars`
                            : "Early Stage",
                        icon: ThumbsUp,
                      },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all"
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                          <stat.icon className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="mono text-[9px] text-slate-600 uppercase font-bold">
                            {stat.label}
                          </span>
                          <span className="text-xs font-mono text-slate-300">
                            {stat.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FLOW & ONBOARDING */}
        <div className="xl:col-span-4 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-white/5 bg-[#0e0e0e]">
            <h2 className="cabinet text-xl font-bold text-white mb-6 flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-slate-500" /> Execution Flow
            </h2>
            <div className="relative pl-4 border-l border-white/10 ml-2 space-y-6 pb-2">
              {data.analysis.execution_flow.map((step, i) => (
                <div key={i} className="relative pl-6">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-[#0e0e0e]" />
                  <span className="mono text-[10px] text-slate-500 font-bold tracking-widest block mb-1 uppercase">
                    Step 0{i + 1}
                  </span>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card p-6 rounded-2xl border border-white/5 bg-[#0e0e0e]">
            <h2 className="cabinet text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-500" /> Developer
              Onboarding
            </h2>
            <div className="space-y-3">
              {data.analysis.onboarding_guide.map((tip, i) => (
                <div
                  key={i}
                  className="flex gap-4 p-4 rounded-xl bg-black/20 border border-white/5"
                >
                  <div className="w-5 h-5 rounded-full bg-[#141414] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="mono text-[9px] text-slate-400 font-bold">
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {tip}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
