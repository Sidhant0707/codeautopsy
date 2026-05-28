// components/interview/FlowEdge.tsx

"use client";

import { EdgeProps, getBezierPath, BaseEdge } from "reactflow";
import { useInterviewStore } from "@/lib/stores/useInterviewStore";

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  markerEnd,
}: EdgeProps) {
  const isInterviewMode = useInterviewStore((state) => state.isInterviewMode);
  const activeNodes = useInterviewStore((state) => state.activeNodes);

  const isActiveEdge =
    isInterviewMode &&
    activeNodes.includes(source) &&
    activeNodes.includes(target);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  if (isActiveEdge) {
    return (
      <>
        <path
          d={edgePath}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={8}
          strokeOpacity={0.15}
        />
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{ stroke: "#22d3ee", strokeWidth: 2.5, opacity: 1 }}
          className="animated"
        />
      </>
    );
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: "#475569",
        strokeWidth: isInterviewMode ? 1 : 2,
        opacity: isInterviewMode ? 0.08 : 1,
        transition: "opacity 0.3s ease",
      }}
    />
  );
}
