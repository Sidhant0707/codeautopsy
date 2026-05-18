"use client";

import { m } from "framer-motion";
import { CreditCard, Lock, Search, Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  SectionHeader,
  stagger,
  fadeUp,
} from "@/components/ui/landing-widgets";
import { pricingPlans } from "@/lib/constants/landing";

export default function PricingSection() {
  return (
    <section
      id="pricing"
      className="py-24 sm:py-32 px-4 sm:px-6 relative z-10 scroll-mt-32"
    >
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Pricing"
          title="Start free. Scale when your repos do."
          description="Simple tiers for individual exploration today, with private repo and team workflows coming next."
          icon={CreditCard}
        />

        <m.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-md lg:max-w-none mx-auto"
        >
          {pricingPlans.map((plan) => (
            <m.div
              key={plan.name}
              variants={fadeUp}
              className={`glass-card p-6 sm:p-10 rounded-2xl flex flex-col relative transition-all bg-[#0a0a0a]/90 backdrop-blur-md ${
                plan.isPrimary
                  ? "border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.1)] lg:scale-105 z-10"
                  : "border-white/[0.08]"
              }`}
            >
              {plan.status === "coming-soon" && (
                <>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-[#0e0e0e]/95 via-[#0e0e0e]/80 to-transparent z-20 flex flex-col items-center justify-end pb-10 sm:pb-12 pointer-events-none">
                    <div className="flex items-center gap-2 text-slate-300 font-mono text-xs uppercase tracking-widest bg-[#141414] px-5 py-2.5 rounded-lg border border-white/10 shadow-xl backdrop-blur-md">
                      <Lock className="w-3.5 h-3.5" /> Locked
                    </div>
                  </div>
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-slate-800 border border-white/10 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest z-30 whitespace-nowrap">
                    {plan.badge}
                  </div>
                </>
              )}

              <div className="mb-6 sm:mb-8 relative z-10 pr-4">
                <h3
                  className={`text-xl font-bold mb-2 ${
                    plan.status === "coming-soon"
                      ? "text-slate-500 italic"
                      : "text-slate-100"
                  }`}
                >
                  {plan.name}
                </h3>
                <p className="min-h-12 text-sm leading-6 text-slate-400">
                  {plan.description}
                </p>
              </div>

              <div className="mb-8 flex items-baseline gap-1 relative z-10">
                <span
                  className={`text-4xl font-bold ${
                    plan.status === "coming-soon"
                      ? "text-slate-600"
                      : "text-white"
                  }`}
                >
                  {plan.price}
                </span>
                <span className="text-slate-500 text-sm">{plan.period}</span>
              </div>

              <ul
                className={`space-y-4 mb-8 sm:mb-10 flex-1 relative z-10 ${
                  plan.status === "coming-soon"
                    ? "text-slate-500"
                    : "text-slate-400"
                }`}
              >
                {plan.features.map((feature, fidx) => (
                  <li
                    key={`${plan.name}-feature-${fidx}`}
                    className="flex gap-3 text-sm"
                  >
                    {plan.status === "coming-soon" ? (
                      <Search className="w-4 h-4 text-slate-700 mt-0.5 flex-shrink-0 rotate-90" />
                    ) : (
                      <Check className="w-5 h-5 text-slate-300 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="relative z-10">
                {plan.status === "active" ? (
                  <Link
                    href={plan.href}
                    className="flex w-full items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all bg-white text-black hover:bg-slate-200 active:scale-95 shadow-lg"
                  >
                    {plan.cta} <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all border border-white/5 text-slate-500 cursor-not-allowed bg-white/[0.02]"
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            </m.div>
          ))}
        </m.div>
      </div>
    </section>
  );
}
