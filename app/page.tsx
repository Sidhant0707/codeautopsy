"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  Link2,
  Cpu,
  Map,
  GraduationCap,
  Users,
  Zap,
  Search,
  Check,
} from "lucide-react";
import {
  FaGithub,
  FaTwitter,
  FaLinkedin,
  FaGoogle,
  FaMicrosoft,
  FaStripe,
} from "react-icons/fa";
import { SiMeta, SiVercel } from "react-icons/si";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import ZipUploader from "@/components/ZipUploader";
import { getSystemTelemetry } from "@/app/actions/telemetry";
import { Activity } from "lucide-react";

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EXPO_OUT },
  },
};

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [maxLimit, setMaxLimit] = useState<number>(3);
  const router = useRouter();
  const [telemetry, setTelemetry] = useState({ successRate: 0, totalScans: 0 });

  useEffect(() => {
    fetch("/api/limits")
      .then((res) => res.json())
      .then((data) => {
        setRemaining(data.remaining);
        setMaxLimit(data.maxTokens); // Add this line
      })
      .catch(() => {
        setRemaining(3);
        setMaxLimit(3);
      });

    getSystemTelemetry().then((data) => setTelemetry(data));
  }, []);

  function handleAnalyze() {
    const trimmed = repoUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("https://github.com/")) {
      alert(
        "Please enter a valid GitHub URL starting with https://github.com/",
      );
      return;
    }
    const parts = trimmed.replace("https://github.com/", "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      alert(
        "Please enter a full repo URL like https://github.com/facebook/react",
      );
      return;
    }
    router.push(`/analyze?repo=${encodeURIComponent(trimmed)}`);
  }

  const features = [
    {
      icon: GraduationCap,
      title: "Students",
      description:
        "Learn from open-source giants. Deconstruct production-grade code to understand best practices.",
    },
    {
      icon: Users,
      title: "Onboarding",
      description:
        "Join a new team and contribute on day one. Understand the stack without 50 hours of walkthroughs.",
    },
    {
      icon: Zap,
      title: "Hackers",
      description:
        "Quickly evaluate starter repos and boilerplates. Spend your time building, not reading docs.",
    },
    {
      icon: Search,
      title: "Recruiters",
      description:
        "Review candidate GitHub profiles efficiently. Verify code quality and project complexity in minutes.",
    },
  ];

  const steps = [
    {
      icon: Link2,
      title: "1. Paste Repo URL",
      description:
        "Simply paste any public GitHub repository link. No setup required.",
    },
    {
      icon: Cpu,
      title: "2. AI Analyzes Code",
      description:
        "Our AI maps dependencies, entry points, and high-level logic in seconds.",
    },
    {
      icon: Map,
      title: "3. Explore Architecture",
      description:
        "Interact with visual diagrams and understand the logic flow instantly.",
    },
  ];

  const pricingPlans = [
    {
      name: "Intern",
      price: "$0",
      period: "/forever",
      features: [
        "5 Public Repos / month",
        "Gemini 1.5 Flash",
        "Basic Architecture Maps",
      ],
      cta: "Get Started",
      isPrimary: true,
      status: "active",
    },
    {
      name: "Specialist",
      price: "$19",
      period: "/mo",
      features: [
        "Private Repositories",
        "Gemini 1.5 Pro",
        "Export to Markdown",
      ],
      cta: "Locked",
      isPrimary: false,
      status: "coming-soon",
      badge: "Coming Soon",
    },
    {
      name: "Chief Surgeon",
      price: "Custom",
      period: "",
      features: [
        "Unlimited Analysis",
        "Team Collaboration",
        "Custom AI Models",
      ],
      cta: "Waitlist",
      isPrimary: false,
      status: "coming-soon",
      badge: "Coming Soon",
    },
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-gradient-to-b from-[#0e0e0e] via-[#0e0e0e] to-[#1a1a1a]">
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: EXPO_OUT }}
          className="absolute top-[-5%] left-[-5%] w-[35%] h-[35%] bg-white/[0.02] blur-[120px] rounded-full"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: EXPO_OUT, delay: 0.2 }}
          className="absolute bottom-[10%] right-[-5%] w-[30%] h-[35%] bg-white/[0.01] blur-[120px] rounded-full"
        />
      </div>

      <Header />

      {/* Hero */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative pt-24 pb-32 px-6 hero-gradient"
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-slate-400 text-xs font-bold mb-8 uppercase tracking-widest"
          >
            <Sparkles className="w-4 h-4 text-slate-300" />
            AI-Powered Code Analysis
          </motion.div>

          {/* NEW TELEMETRY FLEX BANNER */}
          {telemetry.totalScans > 0 && (
            <motion.div
              variants={fadeUp}
              className="max-w-lg mx-auto mb-8 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 flex items-center justify-between shadow-[0_0_15px_rgba(99,102,241,0.1)]"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="font-mono text-[10px] font-bold text-slate-300 tracking-widest uppercase">
                  Live_Engine_Telemetry
                </span>
              </div>
              <div className="flex items-center gap-4 font-mono text-[10px]">
                <div className="flex flex-col items-end">
                  <span className="text-slate-500">ACCURACY</span>
                  <span className="text-green-400 font-bold text-sm">
                    {telemetry.successRate}%
                  </span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col items-end">
                  <span className="text-slate-500">SCANS_LOGGED</span>
                  <span className="text-indigo-300 font-bold text-sm">
                    {telemetry.totalScans}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-[1.1] text-slate-50"
          >
            Understand Any{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-300 to-slate-500">
              Codebase
            </span>{" "}
            in Minutes
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Stop wrestling with unfamiliar code. CodeAutopsy analyzes GitHub
            repositories to provide visual architecture, execution flows, and
            AI-driven insights.
          </motion.p>

          <motion.div variants={fadeUp} className="max-w-3xl mx-auto mb-6">
            <div className="glass-card rounded-2xl p-1 shadow-2xl">
              <div className="relative flex items-center bg-[#0a0a0a] rounded-xl p-3 border border-white/5">
                <FaGithub className="w-6 h-6 ml-2 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="https://github.com/facebook/react"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  className="flex-1 bg-transparent border-none outline-none px-4 text-slate-200 placeholder:text-slate-600/50 font-mono text-sm cursor-text"
                />

                <motion.button
                  onClick={handleAnalyze}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="cursor-pointer btn-gray text-white px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-lg"
                >
                  Analyze →
                </motion.button>
              </div>
            </div>

            {/* System Status Meter */}
            <div className="flex items-center justify-center gap-3 mt-6 mb-2">
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${remaining === 0 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"}`}
              />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">
                {remaining !== null
                  ? `${remaining} / ${maxLimit} Autopsies Available Today`
                  : "Initializing Engine..."}
              </span>
            </div>

            <p className="text-slate-500 text-sm">
              Try:{" "}
              {["expressjs/express", "vercel/next.js", "facebook/react"].map(
                (example) => (
                  <button
                    key={example}
                    onClick={() => setRepoUrl(`https://github.com/${example}`)}
                    className="cursor-pointer text-slate-400 hover:text-white transition-colors mx-1 text-sm font-mono hover:bg-white/5 px-2 py-0.5 rounded-md"
                  >
                    {example}
                  </button>
                ),
              )}
            </p>
            <div className="mt-10 mb-6 relative flex items-center w-full max-w-2xl mx-auto">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink-0 mx-4 text-slate-600 text-[10px] font-mono uppercase tracking-[0.2em]">
                Or Analyze Local Code
              </span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <ZipUploader />
          </motion.div>
        </div>
      </motion.section>

      {/* Trusted by engineers at section */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-10%" }}
        variants={fadeUp}
        className="py-12 border-y border-white/5 bg-white/[0.01]"
      >
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-slate-500 text-[10px] font-bold mb-10 uppercase tracking-[0.3em]">
            Trusted by engineers at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24">
            {[
              { name: "GitHub", Icon: FaGithub },
              { name: "Google", Icon: FaGoogle },
              { name: "Meta", Icon: SiMeta },
              { name: "Microsoft", Icon: FaMicrosoft },
              { name: "Vercel", Icon: SiVercel },
              { name: "Stripe", Icon: FaStripe },
            ].map(({ name, Icon }) => (
              <div
                key={name}
                className="flex items-center gap-3 text-xl font-bold text-slate-500 opacity-40 hover:opacity-100 hover:text-slate-100 transition-all duration-500 grayscale hover:grayscale-0 cursor-default"
              >
                <Icon className="w-6 h-6" />
                <span className="tracking-tight">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* The Autopsy Process section */}
      <section id="how-it-works" className="py-32 px-6">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10%" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto"
        >
          <motion.div variants={fadeUp} className="text-center mb-20">
            <h2 className="text-4xl font-bold mb-4 text-slate-50">
              The Autopsy Process
            </h2>
            <p className="text-slate-400">
              Three steps to complete architectural clarity.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  variants={fadeUp}
                  key={idx}
                  className="flex flex-col items-center text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-white/5 flex items-center justify-center text-slate-300 mb-6">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-slate-100">
                    {step.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* Dissection features section */}
      <section id="features" className="py-32 bg-black/40 px-6">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10%" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <h2 className="text-4xl font-bold mb-6 leading-tight text-slate-50">
                Everything you need to
                <br />
                dissect a project.
              </h2>
              <p className="text-slate-400 mb-10 leading-relaxed">
                Built for the modern developer who doe not have time to browse
                thousands of files manually.
              </p>
              <div className="space-y-6">
                {[
                  {
                    title: "Architecture Diagrams",
                    desc: "Auto-generated maps of folder structures and module relationships.",
                  },
                  {
                    title: "Interactive Q&A",
                    desc: 'Ask things like "Where is the authentication logic?" or "How are API calls handled?"',
                  },
                  {
                    title: "Execution Flow Mapping",
                    desc: "Trace the journey of a request from the UI down to the database level.",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <Check className="w-6 h-6 text-slate-400 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold mb-1 text-slate-100">
                        {item.title}
                      </h4>
                      <p className="text-slate-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="glass-card rounded-2xl overflow-hidden border-white/10"
            >
              <div className="bg-[#141414]/90 px-4 py-2 flex items-center gap-2 border-b border-white/5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                <div className="flex-1 text-center text-[10px] text-slate-500 font-mono">
                  codeautopsy.app/dissection/facebook-react
                </div>
              </div>
              <div className="p-6 space-y-4">
                {[
                  "Architecture: Library",
                  "Entry: index.js",
                  "Files analyzed: 206",
                  "Tech stack: Node.js, Express",
                ].map((line, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    <span className="text-sm font-mono text-slate-500">
                      {line}
                    </span>
                  </div>
                ))}

                <div className="mt-4 p-4 rounded-lg bg-white/[0.02] border border-white/5 font-mono text-[10px] space-y-3">
                  <div className="flex justify-between items-center text-slate-500 border-b border-white/5 pb-2">
                    <span>MAPPING_FLOW</span>
                    <span className="text-emerald-500/50">ACTIVE</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] text-slate-600">
                      <span>Dependency Graph</span>
                      <span>88%</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "88%" }}
                        className="h-full bg-slate-400"
                      />
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-700 italic animate-pulse">
                    Scanning: /src/hooks/useAuth.ts ...
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Tailored Ecosystem section */}
      <section className="py-32 px-6">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10%" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto"
        >
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-50">
              Tailored for the Ecosystem
            </h2>
            <p className="text-slate-400">
              Solutions for students, developers, and talent hunters.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  variants={fadeUp}
                  key={idx}
                  className="glass-card p-8 rounded-2xl hover:bg-white/[0.02] transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-center text-slate-400 mb-6">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold mb-3 text-slate-100">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* Pricing section */}
      <section id="pricing" className="py-32 bg-black/40 px-6">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10%" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto"
        >
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-50">
              Simple, Transparent Pricing
            </h2>
            <p className="text-slate-400">
              Scale as you explore more repositories.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, idx) => (
              <motion.div
                variants={fadeUp}
                key={idx}
                className={`glass-card p-10 rounded-2xl flex flex-col relative transition-all ${
                  plan.isPrimary
                    ? "border-white/10 gray-soft-glow"
                    : "border-white/5"
                } ${plan.status === "coming-soon" ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-slate-800 border border-white/10 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-8">
                  <h3
                    className={`text-lg font-bold mb-2 ${plan.status === "coming-soon" ? "text-slate-500 italic" : "text-slate-100"}`}
                  >
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-4xl font-bold ${plan.status === "coming-soon" ? "text-slate-600" : "text-white"}`}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-slate-500 text-sm">
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>

                <ul
                  className={`space-y-4 mb-10 flex-1 ${plan.status === "coming-soon" ? "text-slate-600" : "text-slate-400"}`}
                >
                  {plan.features.map((feature, fidx) => (
                    <li key={fidx} className="flex gap-3 text-sm">
                      {plan.status === "coming-soon" ? (
                        <Search className="w-4 h-4 text-slate-700 mt-0.5 flex-shrink-0 rotate-90" />
                      ) : (
                        <Check className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
                      )}
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.status === "active" ? (
                  <Link
                    href="/signup"
                    className="cursor-pointer block text-center w-full py-3 rounded-xl font-bold text-sm transition-all btn-gray text-white active:scale-95 shadow-lg shadow-white/5"
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all border border-white/5 text-slate-400 cursor-not-allowed opacity-50"
                  >
                    {plan.cta}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Image
                  src="/codeautopsy-logo1.png"
                  alt="CodeAutopsy Logo"
                  width={28}
                  height={28}
                  className="rounded-sm"
                />
                <span className="text-lg font-bold text-slate-100">
                  CodeAutopsy
                </span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                The world's first AI-powered codebase visualization tool. Built
                for efficiency.
              </p>
            </div>
            {[
              {
                title: "Product",
                links: [
                  { label: "Features", href: "/features" },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Changelog", href: "/changelog" },
                  { label: "Documentation", href: "/docs" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "About", href: "/about" },
                  { label: "Careers", href: "/careers" },
                  { label: "Contact", href: "/contact" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Privacy Policy", href: "/privacy" },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-bold mb-6 text-xs uppercase tracking-[0.2em] text-slate-400">
                  {col.title}
                </h4>
                <ul className="space-y-4">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="cursor-pointer text-slate-400 hover:text-white text-sm transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h4 className="font-bold mb-6 text-xs uppercase tracking-[0.2em] text-slate-400">
                Connect
              </h4>
              <div className="flex gap-4">
                {[
                  { Icon: FaTwitter, href: "https://twitter.com" },
                  { Icon: FaGithub, href: "https://github.com/Sidhant0707" },
                  {
                    Icon: FaLinkedin,
                    href: "https://www.linkedin.com/in/sidhant07",
                  },
                ].map((social, i) => {
                  const IconComponent = social.Icon;
                  return (
                    <a
                      key={i}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-lg bg-[#141414] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all"
                    >
                      <IconComponent className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/5 gap-4">
            <p className="text-slate-600 text-[11px] font-medium tracking-tight uppercase">
              © 2026 CodeAutopsy Inc. All rights reserved.
            </p>
            <p className="text-slate-600 text-[11px] font-medium tracking-tight uppercase">
              Engineered for the developer community
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
