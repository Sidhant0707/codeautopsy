"use client";

import { LazyMotion, domMax } from "framer-motion";
import Header from "@/components/Header";
import { FloatingOrbs } from "@/components/ui/landing-widgets";
import HeroSection from "@/components/landing/HeroSection";

import TrustBar from "@/components/landing/TrustBar";
import FeaturesSection from "@/components/landing/FeaturesSection";
import WorkflowSection from "@/components/landing/WorkflowSection";
import UseCasesSection from "@/components/landing/UseCasesSection";
import StatsSection from "@/components/landing/StatsSection";
import PricingSection from "@/components/landing/PricingSection";
import CtaSection from "@/components/landing/CtaSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <LazyMotion features={domMax} strict>
      <div className="min-h-screen relative overflow-x-hidden bg-[#0e0e0e]">
        <FloatingOrbs />
        <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)] pointer-events-none z-0" />

        <Header />

        <main>
          <HeroSection />

          {/* Create these components next by pasting their <section> blocks! */}
          <TrustBar />
          <FeaturesSection />
          <WorkflowSection />
          <UseCasesSection />
          <StatsSection />
          <PricingSection />
          <CtaSection />
        </main>

        <Footer />
      </div>
    </LazyMotion>
  );
}
