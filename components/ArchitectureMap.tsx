"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
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
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from "d3-force";

// ============================================================================
// GLASS NODE COMPONENT - Defined outside for React Flow stability
// ============================================================================

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

// Define nodeTypes OUTSIDE component to prevent React Flow warning
const nodeTypes = { glass: GlassNode };

// ============================================================================
// D3-FORCE LAYOUT - Compact and constrained for visibility
// ============================================================================

interface ForceNode extends Node {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface ForceLink {
  source: string | ForceNode;
  target: string | ForceNode;
}

function getForceLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  entryPoints: string[]
): { nodes: Node[]; edges: Edge[] } {
  if (!nodes || nodes.length === 0) return { nodes: [], edges: [] };

  // Calculate node importance (in-degree + out-degree)
  const nodeDegree = new Map<string, number>();
  edges.forEach(edge => {
    nodeDegree.set(edge.source, (nodeDegree.get(edge.source) || 0) + 1);
    nodeDegree.set(edge.target, (nodeDegree.get(edge.target) || 0) + 1);
  });

  // Find hub nodes (high-degree nodes like types.ts, utils.ts)
  const maxDegree = Math.max(...Array.from(nodeDegree.values()), 1);
  const hubNodes = new Set(
    Array.from(nodeDegree.entries())
      .filter(([_, degree]) => degree > maxDegree * 0.5)
      .map(([id]) => id)
  );

  // Compact layout dimensions - much smaller for visibility
  const width = 1200;
  const height = 800;
  const centerX = width / 2;
  const centerY = height / 2;

  // Prepare nodes for d3-force with intelligent initial positioning
  const forceNodes: ForceNode[] = nodes.map((node, i) => {
    const isHub = hubNodes.has(node.id);
    const isEntry = entryPoints.includes(node.id);
    
    // Hub nodes start near center, others in a tighter radius
    let x, y;
    if (isHub) {
      // Hubs close to center
      const angle = (i / nodes.length) * 2 * Math.PI;
      x = centerX + Math.cos(angle) * 50;
      y = centerY + Math.sin(angle) * 50;
    } else if (isEntry) {
      // Entry points in outer ring but controlled
      const angle = (i / nodes.length) * 2 * Math.PI;
      x = centerX + Math.cos(angle) * 200;
      y = centerY + Math.sin(angle) * 200;
    } else {
      // Regular nodes in medium radius
      const angle = (i / nodes.length) * 2 * Math.PI;
      x = centerX + Math.cos(angle) * 150;
      y = centerY + Math.sin(angle) * 150;
    }

    return {
      ...node,
      x,
      y,
    };
  });

  // Prepare links for d3-force
  const forceLinks: ForceLink[] = edges.map(edge => ({
    source: edge.source,
    target: edge.target,
  }));

  // Create the force simulation with strict TypeScript constraints
  const simulation = forceSimulation<ForceNode>(forceNodes)
    .force(
      "link",
      forceLink<ForceNode, ForceLink>(forceLinks)
        .id((d: ForceNode) => d.id)
        .distance((d: ForceLink) => {
          // Shorter distances for tighter clustering
          const sourceDegree = nodeDegree.get((d.source as ForceNode).id) || 1;
          const targetDegree = nodeDegree.get((d.target as ForceNode).id) || 1;
          const avgDegree = (sourceDegree + targetDegree) / 2;
          
          // Hub connections are shorter
          return avgDegree > maxDegree * 0.5 ? 80 : 120;
        })
        .strength(1.2) // Very strong links for tight clustering
    )
    .force(
      "charge",
      forceManyBody<ForceNode>()
        .strength((d: ForceNode) => {
          // Hubs repel more strongly
          const degree = nodeDegree.get(d.id) || 1;
          return degree > maxDegree * 0.5 ? -600 : -300;
        })
    )
    .force("center", forceCenter(centerX, centerY).strength(0.1)) // Gentle center pull
    .force(
      "collision",
      forceCollide<ForceNode>().radius((d: ForceNode) => {
        // Bigger collision radius for high-degree nodes
        const degree = nodeDegree.get(d.id) || 1;
        return Math.max(80, Math.min(120, 60 + degree * 3));
      }).strength(0.8)
    )
    .force(
      "x",
      forceX<ForceNode>(centerX).strength((d: ForceNode) => {
        // Stronger pull toward center for hubs
        const degree = nodeDegree.get(d.id) || 1;
        return degree > maxDegree * 0.5 ? 0.3 : 0.1;
      })
    )
    .force(
      "y",
      forceY<ForceNode>(centerY).strength((d: ForceNode) => {
        // Stronger pull toward center for hubs
        const degree = nodeDegree.get(d.id) || 1;
        return degree > maxDegree * 0.5 ? 0.3 : 0.1;
      })
    )
    .alphaDecay(0.01) // Very slow cooling for better convergence
    .velocityDecay(0.4); // More damping for stability

  // Run simulation longer for better convergence
  const numIterations = 500;
  for (let i = 0; i < numIterations; i++) {
    simulation.tick();
    
    // Apply boundary constraints every iteration
    forceNodes.forEach(node => {
      const margin = 100;
      node.x = Math.max(margin, Math.min(width - margin, node.x || centerX));
      node.y = Math.max(margin, Math.min(height - margin, node.y || centerY));
    });
  }

  // Apply computed positions back to nodes
  const layoutedNodes = forceNodes.map(node => ({
    ...node,
    position: {
      x: node.x || 0,
      y: node.y || 0,
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  }));

  return { nodes: layoutedNodes, edges };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ArchitectureMap({
  dependencyGraph = {},
  entryPoints = [],
}: {
  dependencyGraph: Record<string, string[]>;
  entryPoints: string[];
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Build reverse adjacency list (who depends on this file?)
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

  // Generate initial nodes and edges with d3-force layout
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (!dependencyGraph || typeof dependencyGraph !== "object") {
      return { nodes: [], edges: [] };
    }

    // Create nodes
    Object.keys(dependencyGraph).forEach((filePath) => {
      nodes.push({
        id: filePath,
        type: "glass",
        data: {
          label: filePath.split("/").pop() || filePath,
          fullPath: filePath,
          isEntry: entryPoints.includes(filePath),
          isBlastRadius: false,
          isDimmed: false,
        },
        position: { x: 0, y: 0 }, // Will be overwritten by force layout
      });
    });

    // Create edges
    Object.keys(dependencyGraph).forEach((filePath) => {
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

    // Apply force-directed layout
    return getForceLayoutedElements(nodes, edges, entryPoints);
  }, [dependencyGraph, entryPoints]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when initial data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Blast radius effect when node is selected
  useEffect(() => {
    if (!selectedNode) {
      // Reset all nodes and edges to default state
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isBlastRadius: false, isDimmed: false },
        }))
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: { stroke: "#475569", strokeWidth: 2, opacity: 1 },
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
        }))
      );
      return;
    }

    // BFS to find all nodes affected by changes to selectedNode
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

    // Update nodes with blast radius highlighting
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isBlastRadius: blastRadiusNodes.has(n.id),
          isDimmed: !blastRadiusNodes.has(n.id),
        },
      }))
    );

    // Update edges with blast radius highlighting
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
      })
    );
  }, [selectedNode, adjacencyList, setNodes, setEdges]);

  // Memoized callbacks to prevent unnecessary re-renders with strict React typings
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => setSelectedNode(node.id),
    []
  );

  const handlePaneClick = useCallback(() => setSelectedNode(null), []);

  // Empty state
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
      {/* Header */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <h3 className="text-sm font-bold text-slate-300 font-mono tracking-widest uppercase bg-black/50 px-3 py-1 rounded-md backdrop-blur-md border border-white/10 w-fit">
          Interactive Architecture Map
        </h3>
        <div className="text-[10px] font-mono text-slate-400 bg-black/40 px-2 py-1 rounded w-fit border border-white/5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Click nodes to view Blast Radius
        </div>
        <div className="text-[10px] font-mono text-emerald-400 bg-black/40 px-2 py-1 rounded w-fit border border-emerald-500/20">
          🌀 Compact Force Layout · {nodes.length} nodes
        </div>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        className="bg-[#0e0e0e]"
        minZoom={0.3}
        maxZoom={2}
      >
        {/* A subtle, dark blueprint grid */}
<Background 
  variant={BackgroundVariant.Lines} 
  color="#ffffff" 
  gap={32} 
  size={1} 
  className="opacity-[0.03]" 
/>
        <Controls
          className="!bg-[#141414] !rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/10 [&>button]:!bg-[#141414] [&>button]:!border-b-white/10 [&>button]:!fill-slate-400 hover:[&>button]:!bg-white/5 hover:[&>button]:!fill-white transition-colors"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}