"use client";

import { m } from "framer-motion";
import { GitBranch, ArrowRight } from "lucide-react";
import { ease } from "@/components/ui/landing-widgets";

export default function CtaSection() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 relative z-10">
      <div className="max-w-4xl mx-auto text-center">
        <m.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease }}
        >
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-white/20 bg-white/[0.07]">
            <GitBranch className="h-7 w-7 text-slate-300" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-slate-50 leading-tight">
            Start with the repository.
            <br />
            Leave with the map.
          </h2>
          <p className="text-base sm:text-lg text-slate-400 mb-10 max-w-2xl mx-auto px-4">
            Paste a GitHub URL, upload local code, and get the first useful read
            of the system without losing an afternoon.
          </p>
          <m.button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full sm:w-auto px-10 py-4 rounded-xl bg-white text-black font-bold transition-all shadow-xl hover:bg-slate-200 flex items-center justify-center gap-2 mx-auto"
          >
            Analyze now <ArrowRight className="w-4 h-4" />
          </m.button>
        </m.div>
      </div>
    </section>
  );
}
