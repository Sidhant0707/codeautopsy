"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  GitBranch,
  Network,
  Shield,
  GraduationCap,
  Users,
  Zap,
  Search,
  Activity,
  Gauge,
  Brain,
  Terminal,
  Workflow,
  BarChart3,
  Fingerprint,
  Check,
  Lock,
  ArrowRight,
  Clock3,
  UploadCloud,
  FileCode2,
} from "lucide-react";
import {
  FaGithub,
  FaLinkedin,
  FaGoogle,
  FaMicrosoft,
  FaStripe,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { SiMeta, SiVercel } from "react-icons/si";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
} from "framer-motion";
import Header from "@/components/Header";
import ZipUploader from "@/components/ZipUploader";
import { getSystemTelemetry } from "@/app/actions/telemetry";

// ============================================================================
// ANIMATION PRESETS
// ============================================================================

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } },
};

const stagger = {
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

// ============================================================================
// DATA ARRAYS (The Premium Copy)
// ============================================================================

const capabilities = [
  {
    icon: Network,
    label: "Architecture",
    title: "Dependency graph clarity",
    description: "Maps imports, fan-in, fan-out, and file relationships so teams can see the shape of a repo before touching it.",
  },
  {
    icon: Brain,
    label: "Intelligence",
    title: "AI-guided code reading",
    description: "Summarizes entry points, patterns, risk areas, and responsibilities without forcing engineers through every file.",
  },
  {
    icon: Workflow,
    label: "Flow",
    title: "Execution paths",
    description: "Connects routes, services, utilities, and stateful modules into readable flows for onboarding and debugging.",
  },
  {
    icon: Shield,
    label: "Risk",
    title: "Blast radius scanning",
    description: "Shows what breaks when a key file changes, helping teams prioritize review, tests, and migration work.",
  },
  {
    icon: Gauge,
    label: "Quality",
    title: "Complexity signals",
    description: "Highlights dense modules, fragile dependencies, and files that need refactoring before they become bottlenecks.",
  },
  {
    icon: Fingerprint,
    label: "Context",
    title: "Smart entry detection",
    description: "Finds route handlers, app roots, config boundaries, and public APIs so the first read starts in the right place.",
  },
];

const workflow = [
  {
    icon: FaGithub,
    title: "Connect a repo",
    text: "Paste any public GitHub repository URL or upload a local zipped project.",
  },
  {
    icon: FileCode2,
    title: "Parse structure",
    text: "CodeAutopsy filters noise, indexes source files, and builds the dependency model.",
  },
  {
    icon: Brain,
    title: "Generate insight",
    text: "AI produces architecture notes, flow summaries, hotspots, and recommended next steps.",
  },
  {
    icon: BarChart3,
    title: "Act with confidence",
    text: "Use the report to onboard, refactor, review, test, or evaluate a project faster.",
  },
];

const roleCards = [
  {
    icon: Users,
    title: "Engineering Teams",
    text: "Speed up onboarding, refactors, ownership transfer, and incident debugging.",
  },
  {
    icon: GraduationCap,
    title: "Students",
    text: "Study real production codebases with guided architecture explanations.",
  },
  {
    icon: Zap,
    title: "Builders",
    text: "Evaluate starter repos, boilerplates, and unfamiliar libraries before committing.",
  },
  {
    icon: Search,
    title: "Reviewers",
    text: "Scan GitHub projects quickly for structure, maturity, and risk signals.",
  },
];

// ============================================================================
// 3D CARD COMPONENT WITH DYNAMIC GLARE
// ============================================================================

interface Card3DProps {
  children: React.ReactNode;
  className?: string;
}

const Card3D = ({ children, className = "" }: Card3DProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), spring);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), spring);

  const glareX = useTransform(mouseX, [-0.5, 0.5], [100, 0]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], [100, 0]);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.08) 0%, transparent 50%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set((e.clientX - centerX) / rect.width);
    mouseY.set((e.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`relative ${className}`}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-2xl z-50 mix-blend-screen transition-opacity duration-300 hidden md:block"
        style={{ background: glareBackground }}
      />
      {children}
    </motion.div>
  );
};

// ============================================================================
// 3D ICON CONTAINER
// ============================================================================

interface Icon3DProps {
  icon: React.ElementType;
  className?: string;
}

const Icon3D = ({ icon: Icon, className = "" }: Icon3DProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.div
        className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-700/30 to-slate-900/30 backdrop-blur-sm"
        animate={{ z: isHovered ? -20 : -8 }}
        transition={spring}
        style={{ transformStyle: "preserve-3d" }}
      />

      <motion.div
        className="absolute inset-0 rounded-xl bg-[#0a0a0a]/90 border border-white/[0.08]"
        animate={{ z: 0 }}
        style={{ transformStyle: "preserve-3d" }}
      />

      <motion.div
        className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-800/30 to-slate-900/30 border border-white/[0.12] flex items-center justify-center overflow-hidden"
        animate={{ z: isHovered ? 20 : 8 }}
        transition={spring}
        style={{ transformStyle: "preserve-3d" }}
      >
        <motion.div
          animate={{
            rotateZ: isHovered ? -45 : -45,
            rotateX: isHovered ? -25 : -20,
            scale: isHovered ? 1.2 : 1,
          }}
          transition={spring}
        >
          {/* Reverted to crisp white/slate glow */}
          <Icon className="w-6 h-6 text-slate-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-slate-200 shadow-[0_0_20px_4px_rgba(255,255,255,0.8)] hidden md:block"
        animate={{
          height: isHovered ? "80px" : "0px",
          opacity: isHovered ? 0.6 : 0,
        }}
        style={{ rotateX: 90, rotateY: -45, transformStyle: "preserve-3d" }}
        transition={spring}
      />
    </motion.div>
  );
};

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

const Counter = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(String(value).substring(0, 3));
    if (start === end) return;

    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count}</span>;
};

const FloatingOrbs = () => {
  const orbs = useMemo(
    () => [
      { size: 400, duration: 20, x: "-10%", y: "-10%", delay: 0 },
      { size: 300, duration: 25, x: "80%", y: "60%", delay: 5 },
      { size: 350, duration: 30, x: "50%", y: "-5%", delay: 10 },
    ],
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/[0.01] blur-[100px]"
          style={{ width: orb.size, height: orb.size, left: orb.x, top: orb.y }}
          animate={{ y: [0, -30, 0], x: [0, 20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
        />
      ))}
    </div>
  );
};

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string; }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger}
      className="mx-auto mb-16 sm:mb-24 max-w-3xl text-center"
    >
      <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
        <Sparkles className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
          {eyebrow}
        </span>
      </motion.div>
      <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl leading-tight">
        {title}
      </motion.h2>
      <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
        {description}
      </motion.p>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

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
        setMaxLimit(data.maxTokens);
      })
      .catch(() => {
        setRemaining(3);
        setMaxLimit(3);
      });

    getSystemTelemetry().then((data) => setTelemetry(data));
  }, []);

  const handleAnalyze = () => {
    const trimmed = repoUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("https://github.com/")) {
      alert("Please enter a valid GitHub URL starting with https://github.com/");
      return;
    }
    const parts = trimmed.replace("https://github.com/", "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      alert("Please enter a full repo URL like https://github.com/facebook/react");
      return;
    }
    router.push(`/analyze?repo=${encodeURIComponent(trimmed)}`);
  };

  const pricingPlans = [
    {
      name: "Intern",
      price: "$0",
      period: "/forever",
      description: "For learning, scouting, and lightweight repo analysis.",
      features: ["5 public repositories / month", "Groq Llama analysis", "Architecture summary", "Basic dependency map"],
      cta: "Start free",
      isPrimary: true,
      status: "active",
      href: "/signup",
    },
    {
      name: "Specialist",
      price: "$19",
      period: "/mo",
      description: "For engineers using CodeAutopsy in daily work.",
      features: ["Private repositories", "Advanced model routing", "Markdown exports", "Priority analysis queue"],
      cta: "Locked",
      isPrimary: false,
      status: "coming-soon",
      badge: "Coming Soon",
      href: "#",
    },
    {
      name: "Chief Surgeon",
      price: "Custom",
      period: "/team",
      description: "For teams with deeper security and workflow needs.",
      features: ["Unlimited analysis", "Team collaboration", "Custom AI models", "Workflow integrations"],
      cta: "Waitlist",
      isPrimary: false,
      status: "coming-soon",
      badge: "Coming Soon",
      href: "#",
    },
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#0e0e0e]">
      <FloatingOrbs />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)] pointer-events-none z-0" />

      <Header />

      {/* ========================================================================
          HERO SECTION
      ======================================================================== */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-4 sm:px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            
            <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-3 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-2">
               <Sparkles className="h-4 w-4 text-slate-300" />
               <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-300">
                 AI Code Intelligence
               </span>
            </motion.div>

            {telemetry.totalScans > 0 && (
              <motion.div variants={fadeIn} className="flex justify-center mb-8">
                <div className="inline-flex flex-wrap justify-center items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">Live</span>
                  </div>
                  <div className="hidden sm:block w-px h-4 bg-white/[0.08]" />
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 uppercase">Accuracy</span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400"><Counter value={telemetry.successRate} />%</span>
                  </div>
                  <div className="w-px h-4 bg-white/[0.08]" />
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 uppercase">Scans</span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400"><Counter value={telemetry.totalScans} /></span>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.h1 variants={fadeUp} className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 sm:mb-8 tracking-tight leading-[1.1] sm:leading-[1.05]">
              <span className="block text-slate-50 mb-1 sm:mb-2">Understand any codebase</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-slate-400 to-slate-600">
                before it understands you.
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl lg:max-w-3xl mx-auto leading-relaxed mb-10 sm:mb-12 px-2">
              CodeAutopsy turns unfamiliar repositories into architecture maps, dependency insights, execution flows, and prioritized engineering notes in minutes.
            </motion.p>

            <motion.div variants={fadeUp} className="max-w-3xl mx-auto mb-6 px-2 sm:px-0">
              <div className="relative p-[1px] rounded-2xl bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-white/[0.08]">
                <div className="flex flex-col sm:flex-row items-center bg-[#0a0a0a] rounded-2xl p-3 sm:p-4 gap-3">
                  <div className="flex items-center w-full sm:flex-1 h-12 sm:h-auto border border-white/5 sm:border-none rounded-xl sm:rounded-none px-3 sm:px-0 bg-white/[0.02] sm:bg-transparent">
                    <FaGithub className="w-5 h-5 ml-1 sm:ml-2 text-slate-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="https://github.com/facebook/react"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                      className="w-full bg-transparent border-none outline-none px-3 text-slate-200 placeholder:text-slate-600 font-mono text-xs sm:text-sm"
                    />
                  </div>
                  <motion.button
                    onClick={handleAnalyze}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full sm:w-auto px-8 py-3.5 sm:py-3 rounded-xl bg-white text-black font-bold text-sm transition-all shadow-lg hover:bg-slate-200"
                  >
                    Analyze repo →
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 sm:gap-3 mt-6 mb-4">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${remaining === 0 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"} animate-pulse`} />
                <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em] truncate">
                  {remaining !== null ? `${remaining} / ${maxLimit} autopsies available` : "Initializing..."}
                </span>
              </div>

              <p className="text-center text-slate-500 text-xs sm:text-sm flex flex-wrap justify-center gap-2">
                <span className="mt-0.5">Try:</span>
                {["vercel/next.js", "facebook/react", "expressjs/express"].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setRepoUrl(`https://github.com/${ex}`)}
                    className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm font-mono hover:bg-white/[0.05] px-2 py-0.5 rounded"
                  >
                    {ex}
                  </button>
                ))}
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-12 sm:mt-16 px-2 sm:px-0">
              <div className="flex items-center max-w-2xl mx-auto mb-6">
                <div className="flex-1 border-t border-white/[0.05]" />
                <span className="px-4 text-slate-600 text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em]">Or Local Code</span>
                <div className="flex-1 border-t border-white/[0.05]" />
              </div>
              <ZipUploader />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========================================================================
          TRUST BAR
      ======================================================================== */}
      <section className="py-12 sm:py-16 border-y border-white/[0.05] bg-white/[0.01] relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center text-slate-500 text-[9px] sm:text-[10px] font-bold mb-8 sm:mb-12 uppercase tracking-[0.3em]">
            Built for repositories in modern engineering stacks
          </motion.p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 lg:gap-20">
            {[
              { name: "GitHub", Icon: FaGithub },
              { name: "Google", Icon: FaGoogle },
              { name: "Meta", Icon: SiMeta },
              { name: "Microsoft", Icon: FaMicrosoft },
              { name: "Vercel", Icon: SiVercel },
              { name: "Stripe", Icon: FaStripe },
            ].map(({ name, Icon }, i) => (
              <motion.div key={name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 0.4, y: 0 }} whileHover={{ opacity: 1, scale: 1.05 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-bold text-slate-500 grayscale hover:grayscale-0 transition-all duration-500 cursor-default">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="tracking-tight">{name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================
          CORE FEATURES (CAPABILITIES)
      ======================================================================== */}
      <section id="features" className="py-24 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="Production analysis"
            title="The fastest path from unknown repo to useful context."
            description="A cleaner workflow for onboarding, code review, refactoring, hiring screens, and open-source exploration."
          />

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <motion.div key={cap.title} variants={fadeUp}>
                <Card3D>
                  <motion.div className="relative h-full p-6 md:p-8 rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 backdrop-blur-sm overflow-hidden group">
                    <motion.div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="mb-6 flex items-center justify-between relative z-10 [transform:translateZ(20px)]">
                      <div className="w-14 h-14 [perspective:1000px]">
                        <Icon3D icon={cap.icon} className="w-full h-full" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">{cap.label}</span>
                    </div>

                    <div className="relative z-10 [transform:translateZ(20px)]">
                      <h3 className="text-lg font-bold mb-3 text-slate-100 md:group-hover:text-white transition-colors">{cap.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed md:group-hover:text-slate-300 transition-colors">{cap.description}</p>
                    </div>
                  </motion.div>
                </Card3D>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========================================================================
          VISUAL DEMO PREVIEW (ABOUT / WORKFLOW)
      ======================================================================== */}
      <section id="about" className="py-24 sm:py-32 px-4 sm:px-6 bg-black/40 relative z-10 border-y border-white/[0.05]">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="How it works"
            title="A repo walkthrough without the calendar invite."
            description="CodeAutopsy creates a structured first read: where to start, what depends on what, what looks risky, and what deserves a closer human review."
          />

          <div className="grid lg:grid-cols-2 gap-12 sm:gap-16 items-center mt-16">
            {/* Left: Workflow Steps */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {workflow.map((item, index) => (
                <motion.div key={item.title} variants={fadeUp} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04]">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-black/25">
                      <item.icon className="h-5 w-5 text-slate-300" />
                    </div>
                    <span className="font-mono text-xs text-slate-600">0{index + 1}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Right: 3D Terminal Demo */}
            <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease }}>
              <Card3D>
                <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 overflow-hidden shadow-2xl h-full min-h-[400px]">
                  <motion.div className="absolute inset-0 w-full h-[15%] bg-gradient-to-b from-transparent via-white/[0.05] to-transparent pointer-events-none z-50" animate={{ top: ["-20%", "120%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />

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
                    <div className="text-emerald-500">✓ Fetching repository...</div>
                    <div className="text-emerald-500">✓ Building dependency graph...</div>
                    <div className="text-yellow-500 flex items-center gap-3">
                      <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>⟳</motion.span>
                      Analyzing architecture...
                    </div>
                    <div className="text-slate-500 text-xs sm:text-sm mt-8 pt-6 border-t border-white/[0.05]">
                      206 files • 15,847 lines • 12 entry points
                    </div>
                  </div>
                </div>
              </Card3D>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          USE CASES (ROLE CARDS)
      ======================================================================== */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="Use cases"
            title="Useful wherever code changes hands."
            description="From first-day onboarding to open-source learning, CodeAutopsy gives people the context they need before they dive in."
          />

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {roleCards.map((role) => (
              <motion.div key={role.title} variants={fadeUp}>
                 <Card3D>
                  <motion.div className="relative h-full p-6 md:p-8 rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 backdrop-blur-sm overflow-hidden group">
                    <motion.div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative mb-6 w-12 h-12 [perspective:1000px]">
                      <Icon3D icon={role.icon} className="w-full h-full" />
                    </div>
                    <div className="relative [transform:translateZ(20px)]">
                      <h3 className="text-lg font-bold mb-3 text-slate-100 md:group-hover:text-white transition-colors">{role.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed md:group-hover:text-slate-300 transition-colors">{role.text}</p>
                    </div>
                  </motion.div>
                </Card3D>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========================================================================
          STATS / MISSION
      ======================================================================== */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 bg-black/40 relative z-10 border-y border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, ease }}>
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 p-8 sm:p-12 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px]" />

              <div className="relative z-10 text-center mb-12">
                <h2 className="text-3xl font-bold text-white sm:text-4xl">Designed for fast reads, not noisy dashboards.</h2>
                <p className="mt-4 text-base text-slate-400">The homepage starts with the analyzer because that is the job.</p>
              </div>

              <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center z-10 border-t border-white/5 pt-12">
                {[
                  { value: "10M+", label: "Lines Analyzed" },
                  { value: "99.9%", label: "Uptime SLA" },
                  { value: "<3s", label: "Avg Scan" },
                  { value: "500+", label: "Active Users" },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <div className="text-3xl sm:text-4xl font-bold text-white mb-2">{stat.value}</div>
                    <div className="text-slate-500 text-xs sm:text-sm font-medium uppercase tracking-wider">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========================================================================
          PRICING
      ======================================================================== */}
      <section id="pricing" className="py-24 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="Pricing"
            title="Start free. Scale when your repos do."
            description="Simple tiers for individual exploration today, with private repo and team workflows coming next."
          />

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-10%" }} variants={stagger} className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-md lg:max-w-none mx-auto">
            {/* INTERN TIER */}
            <motion.div
              variants={fadeUp}
              className="glass-card p-6 sm:p-10 rounded-2xl flex flex-col relative transition-all bg-[#0a0a0a]/90 backdrop-blur-md border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.1)] lg:scale-105 z-10"
            >
              <div className="mb-6 sm:mb-8 relative z-10 pr-4">
                <h3 className="text-xl font-bold mb-2 text-slate-100">Intern</h3>
                <p className="min-h-12 text-sm leading-6 text-slate-400">For learning, scouting, and lightweight repo analysis.</p>
              </div>

              <div className="mb-8 flex items-baseline gap-1 relative z-10">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-slate-500 text-sm">/ forever</span>
              </div>

              <ul className="space-y-4 mb-8 sm:mb-10 flex-1 relative z-10 text-slate-400">
                {["5 public repositories / month", "Groq Llama analysis", "Architecture summary", "Basic dependency map"].map((feature, fidx) => (
                  <li key={fidx} className="flex gap-3 text-sm">
                    <Check className="w-5 h-5 text-slate-300 mt-0.5 flex-shrink-0" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="relative z-10">
                <Link href="/signup" className="flex w-full items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all bg-white text-black hover:bg-slate-200 active:scale-95 shadow-lg">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* SPECIALIST TIER */}
            <motion.div
              variants={fadeUp}
              className="glass-card p-6 sm:p-10 rounded-2xl flex flex-col relative transition-all bg-[#0a0a0a]/90 backdrop-blur-md border-white/[0.08]"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-[#0e0e0e]/95 via-[#0e0e0e]/80 to-transparent z-20 flex flex-col items-center justify-end pb-10 sm:pb-12 pointer-events-none">
                <div className="flex items-center gap-2 text-slate-300 font-mono text-xs uppercase tracking-widest bg-[#141414] px-5 py-2.5 rounded-lg border border-white/10 shadow-xl backdrop-blur-md">
                  <Lock className="w-3.5 h-3.5" /> Locked
                </div>
              </div>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-slate-800 border border-white/10 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest z-30 whitespace-nowrap">
                Coming Soon
              </div>

              <div className="mb-6 sm:mb-8 relative z-10 pr-4">
                <h3 className="text-xl font-bold mb-2 text-slate-500 italic">Specialist</h3>
                <p className="min-h-12 text-sm leading-6 text-slate-400">For engineers using CodeAutopsy in daily work.</p>
              </div>

              <div className="mb-8 flex items-baseline gap-1 relative z-10">
                <span className="text-4xl font-bold text-slate-600">$19</span>
                <span className="text-slate-500 text-sm">/ mo</span>
              </div>

              <ul className="space-y-4 mb-8 sm:mb-10 flex-1 relative z-10 text-slate-600">
                {["Private repositories", "Advanced model routing", "Markdown exports", "Priority analysis queue"].map((feature, fidx) => (
                  <li key={fidx} className="flex gap-3 text-sm">
                    <Search className="w-4 h-4 text-slate-700 mt-0.5 flex-shrink-0 rotate-90" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="relative z-10">
                <button disabled className="w-full py-3 rounded-xl font-bold text-sm transition-all border border-white/5 text-slate-500 cursor-not-allowed bg-white/[0.02]">
                  Locked
                </button>
              </div>
            </motion.div>

            {/* CHIEF SURGEON TIER */}
            <motion.div
              variants={fadeUp}
              className="glass-card p-6 sm:p-10 rounded-2xl flex flex-col relative transition-all bg-[#0a0a0a]/90 backdrop-blur-md border-white/[0.08]"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-[#0e0e0e]/95 via-[#0e0e0e]/80 to-transparent z-20 flex flex-col items-center justify-end pb-10 sm:pb-12 pointer-events-none">
                <div className="flex items-center gap-2 text-slate-300 font-mono text-xs uppercase tracking-widest bg-[#141414] px-5 py-2.5 rounded-lg border border-white/10 shadow-xl backdrop-blur-md">
                  <Lock className="w-3.5 h-3.5" /> Locked
                </div>
              </div>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-slate-800 border border-white/10 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest z-30 whitespace-nowrap">
                Coming Soon
              </div>

              <div className="mb-6 sm:mb-8 relative z-10 pr-4">
                <h3 className="text-xl font-bold mb-2 text-slate-500 italic">Chief Surgeon</h3>
                <p className="min-h-12 text-sm leading-6 text-slate-400">For teams with deeper security and workflow needs.</p>
              </div>

              <div className="mb-8 flex items-baseline gap-1 relative z-10">
                <span className="text-4xl font-bold text-slate-600">Custom</span>
                <span className="text-slate-500 text-sm">/ team</span>
              </div>

              <ul className="space-y-4 mb-8 sm:mb-10 flex-1 relative z-10 text-slate-600">
                {["Unlimited analysis", "Team collaboration", "Custom AI models", "Workflow integrations"].map((feature, fidx) => (
                  <li key={fidx} className="flex gap-3 text-sm">
                    <Search className="w-4 h-4 text-slate-700 mt-0.5 flex-shrink-0 rotate-90" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="relative z-10">
                <button disabled className="w-full py-3 rounded-xl font-bold text-sm transition-all border border-white/5 text-slate-500 cursor-not-allowed bg-white/[0.02]">
                  Waitlist
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========================================================================
          CTA
      ======================================================================== */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease }}>
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-white/20 bg-white/[0.07]">
              <GitBranch className="h-7 w-7 text-slate-300" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-slate-50 leading-tight">Start with the repository.<br/>Leave with the map.</h2>
            <p className="text-base sm:text-lg text-slate-400 mb-10 max-w-2xl mx-auto px-4">Paste a GitHub URL, upload local code, and get the first useful read of the system without losing an afternoon.</p>
            <motion.button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto px-10 py-4 rounded-xl bg-white text-black font-bold transition-all shadow-xl hover:bg-slate-200 flex items-center justify-center gap-2 mx-auto">
              Analyze now <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ========================================================================
          FOOTER
      ======================================================================== */}
      <footer className="py-16 sm:py-20 px-4 sm:px-6 border-t border-white/[0.05] relative z-10 bg-[#080908]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 sm:gap-12 mb-12 sm:mb-16">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <Image src="/codeautopsy-logo1.png" alt="Logo" width={28} height={28} className="rounded-sm" />
                <span className="text-lg font-bold text-slate-100">CodeAutopsy</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">AI-powered codebase analysis for developers who need context quickly.</p>
            </div>

            {[
              { title: "Product", links: ["Features", "Pricing", "Docs", "Changelog"] },
              { title: "Company", links: ["About", "Careers", "Contact", "Terms"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-bold mb-4 sm:mb-6 text-xs uppercase tracking-[0.2em] text-slate-500">{col.title}</h4>
                <ul className="space-y-3 sm:space-y-4">
                  {col.links.map((link) => {
                    const targetPath = ["Features", "Pricing", "About"].includes(link) ? `/#${link.toLowerCase()}` : `/${link.toLowerCase()}`;
                    return (
                      <li key={link}>
                        <Link href={targetPath} className="text-slate-400 hover:text-white text-sm transition-colors">{link}</Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <div>
              <h4 className="font-bold mb-4 sm:mb-6 text-xs uppercase tracking-[0.2em] text-slate-500">Connect</h4>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                {[
                  { Icon: FaXTwitter, href: "https://x.com/SiDHANT0707" },
                  { Icon: FaGithub, href: "https://github.com/Sidhant0707" },
                  { Icon: FaLinkedin, href: "https://www.linkedin.com/in/sidhant07" },
                ].map((social, i) => (
                  <a key={i} href={social.href} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-white/[0.035] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:border-white/[0.16] transition-all flex-shrink-0">
                    <social.Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-white/[0.05] gap-4 text-center sm:text-left">
            <p className="text-slate-600 text-[10px] sm:text-[11px] uppercase">© 2026 CodeAutopsy Inc. All rights reserved.</p>
            <p className="text-slate-600 text-[10px] sm:text-[11px] uppercase">Engineered for faster codebase comprehension.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}