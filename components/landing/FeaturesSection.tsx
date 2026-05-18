"use client";

import { m } from "framer-motion";
import { Network } from "lucide-react";
import {
  SectionHeader,
  Card3D,
  Icon3D,
  stagger,
  fadeUp,
} from "@/components/ui/landing-widgets";
import { capabilities } from "@/lib/constants/landing";

export default function FeaturesSection() {
  return (
    <section
      id="features"
      className="py-24 sm:py-32 px-4 sm:px-6 relative z-10 scroll-mt-32"
    >
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Production analysis"
          title="The fastest path from unknown repo to useful context."
          description="A cleaner workflow for onboarding, code review, refactoring, hiring screens, and open-source exploration."
          icon={Network}
        />

        <m.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {capabilities.map((cap) => (
            <m.div key={cap.title} variants={fadeUp}>
              <Card3D>
                <m.div className="relative h-full p-6 md:p-8 rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 backdrop-blur-sm overflow-hidden group">
                  <m.div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="mb-6 flex items-center justify-between relative z-10 [transform:translateZ(20px)]">
                    <div className="w-14 h-14 [perspective:1000px]">
                      <Icon3D icon={cap.icon} className="w-full h-full" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
                      {cap.label}
                    </span>
                  </div>

                  <div className="relative z-10 [transform:translateZ(20px)]">
                    <h3 className="text-lg font-bold mb-3 text-slate-100 md:group-hover:text-white transition-colors">
                      {cap.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed md:group-hover:text-slate-300 transition-colors">
                      {cap.description}
                    </p>
                  </div>
                </m.div>
              </Card3D>
            </m.div>
          ))}
        </m.div>
      </div>
    </section>
  );
}
