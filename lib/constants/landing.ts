import {
  Network,
  Brain,
  Workflow,
  Shield,
  Gauge,
  Fingerprint,
  Users,
  GraduationCap,
  Zap,
  Search,
  FileCode2,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { BarChart3 } from "lucide-react";

export const capabilities = [
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
] as const;

export const workflow = [
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
] as const;

export const roleCards = [
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
] as const;

export const pricingPlans = [
  {
    name: "Intern",
    price: "$0",
    period: "/forever",
    description: "For learning, scouting, and lightweight repo analysis.",
    features: [
      "5 autopsies / day",
      "Groq Llama analysis",
      "Architecture summary",
      "Basic dependency map",
    ],
    cta: "Start free",
    isPrimary: false,
    status: "active",
    href: "/signup",
  },
  {
    name: "Specialist",
    price: "₹99",
    period: "/mo",
    description: "For engineers using CodeAutopsy in daily work.",
    features: [
      "100 autopsies / day",
      "Private repositories",
      "Advanced model routing",
      "Markdown exports",
      "Priority analysis queue",
    ],
    cta: "Upgrade to Specialist →",
    isPrimary: true,
    status: "active",
    badge: "Early Access",
    href: "/pricing",
  },
  {
    name: "Chief Surgeon",
    price: "Custom",
    period: "/team",
    description: "For teams with deeper security and workflow needs.",
    features: [
      "Unlimited analysis",
      "Team collaboration",
      "Custom AI models",
      "Workflow integrations",
    ],
    cta: "Waitlist",
    isPrimary: false,
    status: "coming-soon",
    badge: "Coming Soon",
    href: "#",
  },
] as const;