"use client";

import { m } from "framer-motion";
import { FaGithub, FaGoogle, FaMicrosoft, FaStripe } from "react-icons/fa";
import { SiMeta, SiVercel } from "react-icons/si";

export default function TrustBar() {
  return (
    <section className="py-12 sm:py-16 border-y border-white/[0.05] bg-white/[0.01] relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <m.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-slate-500 text-[9px] sm:text-[10px] font-bold mb-8 sm:mb-12 uppercase tracking-[0.3em]"
        >
          Built for repositories in modern engineering stacks
        </m.p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 lg:gap-20">
          {[
            { name: "GitHub", Icon: FaGithub },
            { name: "Google", Icon: FaGoogle },
            { name: "Meta", Icon: SiMeta },
            { name: "Microsoft", Icon: FaMicrosoft },
            { name: "Vercel", Icon: SiVercel },
            { name: "Stripe", Icon: FaStripe },
          ].map(({ name, Icon }, i) => (
            <m.div
              key={name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 0.4, y: 0 }}
              whileHover={{ opacity: 1, scale: 1.05 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-bold text-slate-500 grayscale hover:grayscale-0 transition-all duration-500 cursor-default"
            >
              <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="tracking-tight">{name}</span>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
