"use client";

import { m } from "framer-motion";
import { Cpu } from "lucide-react";
import {
  SectionHeader,
  Card3D,
  stagger,
  fadeUp,
  ease,
} from "@/components/ui/landing-widgets";
import { workflow } from "@/lib/constants/landing";

export default function WorkflowSection() {
  return (
    <section
      id="about"
      className="py-24 sm:py-32 px-4 sm:px-6 bg-black/40 relative z-10 border-y border-white/[0.05] scroll-mt-32"
    >
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="How it works"
          title="A repo walkthrough without the calendar invite."
          description="CodeAutopsy creates a structured first read: where to start, what depends on what, what looks risky, and what deserves a closer human review."
          icon={Cpu}
        />

        <div className="grid lg:grid-cols-2 gap-12 sm:gap-16 items-center mt-16">
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
          >
            {workflow.map((item, index) => (
              <m.div
                key={item.title}
                variants={fadeUp}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-black/25">
                    <item.icon className="h-5 w-5 text-slate-300" />
                  </div>
                  <span className="font-mono text-xs text-slate-600">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {item.text}
                </p>
              </m.div>
            ))}
          </m.div>

          <m.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease }}
          >
            <Card3D>
              <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 overflow-hidden shadow-2xl h-full min-h-[400px]">
                <m.div
                  className="absolute inset-0 w-full h-[15%] bg-gradient-to-b from-transparent via-white/[0.05] to-transparent pointer-events-none z-50"
                  animate={{ y: ["-20%", "120%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  style={{ willChange: "transform" }}
                />

                <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/[0.05] relative z-40">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]/80" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]/80" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]/80" />
                  <span className="ml-2 text-[10px] sm:text-[11px] font-mono text-slate-500 truncate">
                    analyzing: facebook/react
                  </span>
                </div>

                <div className="p-6 sm:p-8 font-mono text-sm sm:text-base space-y-4 relative z-40">
                  <div className="text-slate-600">$ codeautopsy scan</div>
                  <div className="text-emerald-500">
                    ✓ Fetching repository...
                  </div>
                  <div className="text-emerald-500">
                    ✓ Building dependency graph...
                  </div>
                  <div className="text-yellow-500 flex items-center gap-3">
                    <m.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      ⟳
                    </m.span>
                    Analyzing architecture...
                  </div>
                  <div className="text-slate-500 text-xs sm:text-sm mt-8 pt-6 border-t border-white/[0.05]">
                    206 files • 15,847 lines • 12 entry points
                  </div>
                </div>
              </div>
            </Card3D>
          </m.div>
        </div>
      </div>
    </section>
  );
}
