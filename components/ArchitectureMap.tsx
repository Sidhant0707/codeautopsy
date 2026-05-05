"use client";

import React, { useMemo, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";

interface GlassNodeData {
  isBlastRadius: boolean;
  isDimmed: boolean;
  isEntry?: boolean;
  fullPath: string;
  label: string;
}


const GlassNode = ({ data }: { data: GlassNodeData }) => {
  const isBlastRadius = data.isBlastRadius;
  const isDimmed = data.isDimmed;

  return (
    <div
      className={`px-4 py-2 shadow-xl rounded-xl backdrop-blur-md min-w-[150px] transition-all duration-300 cursor-pointer ${
        isBlastRadius
          ? "bg-red-500/10 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
          : isDimmed
            ? "bg-[#141414]/40 border border-white/5 opacity-30"
            : "bg-[#141414]/90 border border-white/10 hover:border-slate-500"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`w-2 h-2 border-none transition-colors ${
          isBlastRadius ? "!bg-red-500" : "!bg-slate-500"
        }`}
      />
      <div className="flex flex-col items-center justify-center">
        {data.isEntry && (
          <div className="text-[8px] uppercase tracking-widest text-amber-500 font-bold mb-1">
            Entry Point
          </div>
        )}
        <div
          className={`text-sm font-mono truncate max-w-[200px] transition-colors ${
            isBlastRadius
              ? "text-red-200"
              : isDimmed
                ? "text-slate-600"
                : "text-slate-200"
          }`}
          title={data.fullPath}
        >
          {data.label}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={`w-2 h-2 border-none transition-colors ${
          isBlastRadius ? "!bg-red-500" : "!bg-slate-500"
        }`}
      />
    </div>
  );
};

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "TB",
) => {
  if (!nodes || !edges) return { nodes: [], edges: [] };

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 200;
  const nodeHeight = 60;

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: direction === "TB" ? Position.Top : Position.Left,
      sourcePosition: direction === "TB" ? Position.Bottom : Position.Right,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export default function ArchitectureMap({
  dependencyGraph = {},
  entryPoints = [],
}: {
  dependencyGraph: Record<string, string[]>;
  entryPoints: string[];
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  
  const nodeTypes = useMemo(() => ({ glass: GlassNode }), []);

  const adjacencyList = useMemo(() => {
    const reverseGraph: Record<string, string[]> = {};
    Object.keys(dependencyGraph).forEach((src) => {
      const deps = dependencyGraph[src];
      if (Array.isArray(deps)) {
        deps.forEach((tgt) => {
          if (!reverseGraph[tgt]) reverseGraph[tgt] = [];
          reverseGraph[tgt].push(src);
        });
      }
    });
    return reverseGraph;
  }, [dependencyGraph]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (!dependencyGraph || typeof dependencyGraph !== "object") {
      return { nodes: [], edges: [] };
    }

    Object.keys(dependencyGraph).forEach((filePath) => {
      nodes.push({
        id: filePath,
        type: "glass",
        data: {
          label: filePath.split("/").pop(),
          fullPath: filePath,
          isEntry: entryPoints.includes(filePath),
          isBlastRadius: false,
          isDimmed: false,
        },
        position: { x: 0, y: 0 },
      });

      const deps = dependencyGraph[filePath];
      if (Array.isArray(deps)) {
        deps.forEach((depPath) => {
          edges.push({
            id: `e-${filePath}-${depPath}`,
            source: filePath,
            target: depPath,
            animated: true,
            style: { stroke: "#475569", strokeWidth: 2, opacity: 1 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#475569",
            },
          });
        });
      }
    });

    return getLayoutedElements(nodes, edges);
  }, [dependencyGraph, entryPoints]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    if (!selectedNode) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isBlastRadius: false, isDimmed: false },
        })),
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: { stroke: "#475569", strokeWidth: 2, opacity: 1 },
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
        })),
      );
      return;
    }

    const blastRadiusNodes = new Set<string>();
    const blastRadiusEdges = new Set<string>();
    const queue = [selectedNode];
    blastRadiusNodes.add(selectedNode);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = adjacencyList[current] || [];
      dependents.forEach((dep) => {
        const edgeId = `e-${dep}-${current}`;
        blastRadiusEdges.add(edgeId);
        if (!blastRadiusNodes.has(dep)) {
          blastRadiusNodes.add(dep);
          queue.push(dep);
        }
      });
    }

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isBlastRadius: blastRadiusNodes.has(n.id),
          isDimmed: !blastRadiusNodes.has(n.id),
        },
      })),
    );

    setEdges((eds) =>
      eds.map((e) => {
        const isBlastEdge = blastRadiusEdges.has(e.id);
        return {
          ...e,
          style: {
            stroke: isBlastEdge ? "#ef4444" : "#475569",
            strokeWidth: isBlastEdge ? 3 : 2,
            opacity: isBlastEdge ? 1 : 0.2,
          },
          animated: isBlastEdge,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isBlastEdge ? "#ef4444" : "#475569",
          },
        };
      }),
    );
  }, [selectedNode, adjacencyList, setNodes, setEdges]);

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center rounded-2xl border border-white/5 bg-black/40">
        <p className="text-slate-500 font-mono text-sm">
          No dependency graph data available.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-white/5 bg-black/40 relative">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <h3 className="text-sm font-bold text-slate-300 font-mono tracking-widest uppercase bg-black/50 px-3 py-1 rounded-md backdrop-blur-md border border-white/10 w-fit">
          Interactive Architecture Map
        </h3>
        <div className="text-[10px] font-mono text-slate-400 bg-black/40 px-2 py-1 rounded w-fit border border-white/5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Click nodes to view Blast Radius
        </div>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onPaneClick={() => setSelectedNode(null)}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#0e0e0e]"
      >
        <Background color="#333" gap={16} />
        <Controls
          className="!bg-[#141414] !rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/10 [&>button]:!bg-[#141414] [&>button]:!border-b-white/10 [&>button]:!fill-slate-400 hover:[&>button]:!bg-white/5 hover:[&>button]:!fill-white transition-colors"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
