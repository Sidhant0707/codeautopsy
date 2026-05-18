"use client";

import { m } from "framer-motion";
import { ease } from "@/components/ui/landing-widgets";

export default function StatsSection() {
  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 bg-black/40 relative z-10 border-y border-white/[0.05]">
      <div className="max-w-5xl mx-auto">
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease }}
        >
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 p-8 sm:p-12 overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px]" />

            <div className="relative z-10 text-center mb-12">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Designed for fast reads, not noisy dashboards.
              </h2>
              <p className="mt-4 text-base text-slate-400">
                The homepage starts with the analyzer because that is the job.
              </p>
            </div>

            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center z-10 border-t border-white/5 pt-12">
              {[
                { value: "10M+", label: "Lines Analyzed" },
                { value: "99.9%", label: "Uptime SLA" },
                { value: "<3s", label: "Avg Scan" },
                { value: "500+", label: "Active Users" },
              ].map((stat, i) => (
                <m.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
                    {stat.value}
                  </div>
                  <div className="text-slate-500 text-xs sm:text-sm font-medium uppercase tracking-wider">
                    {stat.label}
                  </div>
                </m.div>
              ))}
            </div>
          </div>
        </m.div>
      </div>
    </section>
  );
}
