"use client";

import React, { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";

const GlassNode = ({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-xl rounded-xl bg-[#141414]/90 border border-white/10 backdrop-blur-md min-w-[150px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 !bg-slate-500 border-none"
      />
      <div className="flex flex-col items-center justify-center">
        {data.isEntry && (
          <div className="text-[8px] uppercase tracking-widest text-amber-500 font-bold mb-1">
            Entry Point
          </div>
        )}
        <div
          className="text-sm font-mono text-slate-200 truncate max-w-[200px]"
          title={data.fullPath}
        >
          {data.label}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 !bg-slate-500 border-none"
      />
    </div>
  );
};

const nodeTypes = {
  glass: GlassNode,
};

const getLayoutedElements = (nodes: any[], edges: any[], direction = "TB") => {
  // Safety check: if nodes or edges are undefined, return empty arrays
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
  dependencyGraph = {}, // Provide default empty object
  entryPoints = [],
}: {
  dependencyGraph: Record<string, string[]>;
  entryPoints: string[];
}) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];

    // Additional safety check
    if (!dependencyGraph || typeof dependencyGraph !== "object") {
      return { initialNodes: [], initialEdges: [] };
    }

    Object.keys(dependencyGraph).forEach((filePath) => {
      nodes.push({
        id: filePath,
        type: "glass",
        data: {
          label: filePath.split("/").pop(),
          fullPath: filePath,
          isEntry: entryPoints.includes(filePath),
        },
        position: { x: 0, y: 0 },
      });

      const deps = dependencyGraph[filePath];
      // Ensure deps is an array before iterating
      if (Array.isArray(deps)) {
        deps.forEach((depPath) => {
          edges.push({
            id: `e-${filePath}-${depPath}`,
            source: filePath,
            target: depPath,
            animated: true,
            style: { stroke: "#475569", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#475569",
            },
          });
        });
      }
    });

    // getLayoutedElements returns { nodes: layoutedNodes, edges }
    const layout = getLayoutedElements(nodes, edges);
    return { initialNodes: layout.nodes, initialEdges: layout.edges };
  }, [dependencyGraph, entryPoints]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    const layouted = getLayoutedElements(initialNodes, initialEdges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // If there's no data to show, display a fallback
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
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-sm font-bold text-slate-300 font-mono tracking-widest uppercase bg-black/50 px-3 py-1 rounded-md backdrop-blur-md border border-white/10">
          Interactive Architecture Map
        </h3>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#0e0e0e]"
      >
        <Background color="#333" gap={16} />
        <Controls
          className="!bg-white !rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border-none [&>button]:!bg-white [&>button]:!border-b-slate-200 [&>button]:!fill-black hover:[&>button]:!bg-slate-100"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
