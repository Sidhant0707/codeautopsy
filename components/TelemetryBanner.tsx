import { getSystemTelemetry } from "@/app/actions/telemetry";
import { Activity } from "lucide-react";

export async function TelemetryBanner() {
  
  const { successRate, totalScans } = await getSystemTelemetry();

  
  if (totalScans === 0) return null;

  return (
    <div className="w-full mb-8 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 flex items-center justify-between shadow-[0_0_15px_rgba(99,102,241,0.1)]">
      <div className="flex items-center gap-3">
        <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
        <span className="font-mono text-sm font-bold text-slate-300 tracking-widest uppercase">
          Live_System_Telemetry
        </span>
      </div>

      <div className="flex items-center gap-6 font-mono text-sm">
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500">
            DIAGNOSTIC_ACCURACY
          </span>
          <span className="text-green-400 font-bold text-lg">
            {successRate}%
          </span>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500">TOTAL_SCANS_LOGGED</span>
          <span className="text-indigo-300 font-bold text-lg">
            {totalScans}
          </span>
        </div>
      </div>
    </div>
  );
}
