"use client";

import { m } from "framer-motion";
import { Users } from "lucide-react";
import {
  SectionHeader,
  Card3D,
  Icon3D,
  stagger,
  fadeUp,
} from "@/components/ui/landing-widgets";
import { roleCards } from "@/lib/constants/landing";

export default function UseCasesSection() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Use cases"
          title="Useful wherever code changes hands."
          description="From first-day onboarding to open-source learning, CodeAutopsy gives people the context they need before they dive in."
          icon={Users}
        />

        <m.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {roleCards.map((role) => (
            <m.div key={role.title} variants={fadeUp}>
              <Card3D>
                <m.div className="relative h-full p-6 md:p-8 rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 backdrop-blur-sm overflow-hidden group">
                  <m.div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative mb-6 w-12 h-12 [perspective:1000px]">
                    <Icon3D icon={role.icon} className="w-full h-full" />
                  </div>
                  <div className="relative [transform:translateZ(20px)]">
                    <h3 className="text-lg font-bold mb-3 text-slate-100 md:group-hover:text-white transition-colors">
                      {role.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed md:group-hover:text-slate-300 transition-colors">
                      {role.text}
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
