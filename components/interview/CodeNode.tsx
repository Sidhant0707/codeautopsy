// components/interview/CodeNode.tsx

"use client";

import { Handle, Position } from "reactflow";
import { useInterviewStore } from "@/lib/stores/useInterviewStore";

type CodeNodeData = {
  isBlastRadius: boolean;
  isDimmed: boolean;
  isEntry?: boolean;
  fullPath: string;
  label: string;
};

type CodeNodeProps = {
  id: string;
  data: CodeNodeData;
};

export function CodeNode({ id, data }: CodeNodeProps) {
  const isInterviewMode = useInterviewStore((state) => state.isInterviewMode);
  const activeNodes = useInterviewStore((state) => state.activeNodes);

  const isInterviewActive = isInterviewMode && activeNodes.includes(id);
  const isInterviewDimmed = isInterviewMode && !activeNodes.includes(id);

  function getContainerClass(): string {
    if (isInterviewActive) {
      return "bg-[#141414]/90 border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]";
    }
    if (isInterviewDimmed) {
      return "bg-[#141414]/40 border border-white/5 opacity-20";
    }
    if (data.isBlastRadius) {
      return "bg-red-500/10 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]";
    }
    if (data.isDimmed) {
      return "bg-[#141414]/40 border border-white/5 opacity-30";
    }
    return "bg-[#141414]/90 border border-white/10 hover:border-slate-500";
  }

  function getLabelClass(): string {
    if (isInterviewActive) return "text-cyan-300";
    if (isInterviewDimmed) return "text-slate-600";
    if (data.isBlastRadius) return "text-red-200";
    if (data.isDimmed) return "text-slate-600";
    return "text-slate-200";
  }

  function getHandleClass(): string {
    if (isInterviewActive) return "!bg-cyan-400";
    if (data.isBlastRadius) return "!bg-red-500";
    return "!bg-slate-500";
  }

  return (
    <div className="relative">
      {isInterviewActive && (
        <div className="absolute -inset-1 rounded-xl bg-cyan-400/10 animate-pulse pointer-events-none" />
      )}

      <div
        className={`relative px-4 py-2 shadow-xl rounded-xl backdrop-blur-md min-w-[150px] cursor-pointer transition-all duration-300 ${getContainerClass()}`}
      >
        <Handle
          type="target"
          position={Position.Top}
          className={`w-2 h-2 border-none transition-colors ${getHandleClass()}`}
        />

        <div className="flex flex-col items-center justify-center">
          {data.isEntry && !isInterviewActive && (
            <div className="text-[8px] uppercase tracking-widest text-amber-500 font-bold mb-1">
              Entry Point
            </div>
          )}

          {isInterviewActive && (
            <div className="text-[8px] uppercase tracking-widest text-cyan-400 font-bold mb-1">
              In Discussion
            </div>
          )}

          <div
            className={`text-sm font-mono truncate max-w-[200px] transition-colors ${getLabelClass()}`}
            title={data.fullPath}
          >
            {data.label}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className={`w-2 h-2 border-none transition-colors ${getHandleClass()}`}
        />
      </div>
    </div>
  );
}
