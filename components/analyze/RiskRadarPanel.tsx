// components/analyze/RiskRadarPanel.tsx

"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RepoData } from "@/lib/types/analyze";
import SkeletonLoader from "@/components/analyze/SkeletonLoader";

const RiskDashboard = dynamic(() => import("@/components/RiskDashboard"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});

interface RiskRadarPanelProps {
  data: RepoData;
  isPro: boolean;
}

export default function RiskRadarPanel({ data, isPro }: RiskRadarPanelProps) {
  return (
    <motion.div
      key="risk_radar"
      role="tabpanel"
      id="tabpanel-risk_radar"
      aria-labelledby="tab-risk_radar"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      className="absolute inset-0 p-4 sm:p-6 overflow-y-auto custom-scrollbar"
    >
      {data.coverageGaps && data.fileContents ? (
        <ErrorBoundary fallbackMessage="Risk dashboard failed to load.">
          <RiskDashboard
            coverageGaps={data.coverageGaps}
            fileContents={data.fileContents}
            isPro={isPro}
          />
        </ErrorBoundary>
      ) : (
        <div className="flex items-center justify-center h-full text-slate-500 font-mono text-sm">
          No risk data available for this codebase.
        </div>
      )}
    </motion.div>
  );
}
