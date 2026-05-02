"use client";

import React, { useMemo, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  Edge,
  useNodesState,
  useEdgesState,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { hierarchy, tree } from "d3-hierarchy";


interface DirectoryNode {
  name: string;
  path: string;
  isFolder: boolean;
  color?: string;
  children?: DirectoryNode[];
}

interface TreeNodeData {
  name: string;
  isFolder: boolean;
  color?: string;
  isDimmed: boolean;
}

// --- CUSTOM NODE ---
const TreeNode = ({ data }: { data: TreeNodeData }) => {
  return (
    <div
      className={`flex items-center gap-2 relative transition-all duration-300 cursor-pointer ${
        data.isDimmed ? "opacity-20 grayscale" : "opacity-100 hover:scale-105"
      }`}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div
        className={`w-3 h-3 rounded-full border-2 border-[#0e0e0e] shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10 transition-colors ${
          data.isFolder ? "bg-slate-600" : `bg-${data.color}-500`
        }`}
      />
      <div
        className={`font-mono text-xs whitespace-nowrap transition-colors ${
          data.isFolder
            ? data.isDimmed
              ? "text-slate-600"
              : "text-slate-400 font-bold"
            : data.isDimmed
              ? "text-slate-700"
              : "text-slate-200"
        }`}
      >
        {data.name}
      </div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
};

const nodeTypes = { treeNode: TreeNode };

// --- COLOR PALETTE FOR FILES ---
const COLORS = [
  "blue",
  "emerald",
  "purple",
  "amber",
  "pink",
  "cyan",
  "rose",
  "indigo",
];

export default function DirectoryTreeVisualizer({
  metrics,
}: {
  metrics: { path: string; size: number }[];
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!metrics || metrics.length === 0)
      return { initialNodes: [], initialEdges: [] };

    // 1. Build the nested JSON hierarchy
    const rootNode: DirectoryNode = { 
      name: "root", 
      path: "root", 
      isFolder: true,
      color: "slate",
      children: [] 
    };
    let colorIndex = 0;
    const folderColorMap = new Map<string, string>();

    metrics.forEach((metric) => {
      const parts = metric.path.split("/");
      let currentLevel = rootNode.children!;
      let currentPath = "root"; // Base ID matches root

      parts.forEach((part, index) => {
        currentPath = `${currentPath}/${part}`;
        const isFile = index === parts.length - 1;

        let existing = currentLevel.find((n) => n.name === part);

        if (!existing) {
          const topFolder = parts.length > 1 ? parts[0] : "root";
          if (!folderColorMap.has(topFolder)) {
            folderColorMap.set(topFolder, COLORS[colorIndex % COLORS.length]);
            colorIndex++;
          }

          existing = {
            name: part,
            path: currentPath,
            isFolder: !isFile,
            color: folderColorMap.get(topFolder),
            children: isFile ? undefined : [],
          };
          currentLevel.push(existing);
        }

        if (!isFile && existing.children) {
          currentLevel = existing.children;
        }
      });
    });

    // 2. Run D3 Math
    const d3Root = hierarchy(rootNode);
    const treeLayout = tree<DirectoryNode>().nodeSize([25, 250]);;
    treeLayout(d3Root);

    // 3. Map D3 output to ReactFlow
    const rfNodes: Node<TreeNodeData>[] = [];
    const rfEdges: Edge[] = [];

    d3Root.descendants().forEach((node) => {
      rfNodes.push({
        id: node.data.path,
        type: "treeNode",
        position: { x: node.y ?? 0, y: node.x ?? 0 },
        data: {
          name: node.data.name,
          isFolder: node.data.isFolder,
          color: node.data.color,
          isDimmed: false,
        },
      });
    });

    d3Root.links().forEach((link) => {
      rfEdges.push({
        id: `e-${link.source.data.path}-${link.target.data.path}`,
        source: link.source.data.path,
        target: link.target.data.path,
        type: "default",
        animated: false,
        style: { stroke: "#334155", strokeWidth: 1.5, opacity: 0.4 },
      });
    });

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [metrics]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync data on load
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle the Sub-Tree Click Isolation
  useEffect(() => {
    if (!selectedPath) {
      // Reset everything if background is clicked
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, isDimmed: false } })),
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: {
            ...e.style,
            opacity: 0.4,
            strokeWidth: 1.5,
            stroke: "#334155",
          },
        })),
      );
      return;
    }

    // Determine active path (Ancestors + Descendants)
    setNodes((nds) =>
      nds.map((n) => {
        const isActive =
          n.id === selectedPath || // Exact match
          selectedPath.startsWith(n.id + "/") || // Ancestor (e.g. root/app contains root/app/api)
          n.id.startsWith(selectedPath + "/"); // Descendant (e.g. root/app/api is inside root/app)

        return { ...n, data: { ...n.data, isDimmed: !isActive } };
      }),
    );

    setEdges((eds) =>
      eds.map((e) => {
        const sActive =
          e.source === selectedPath ||
          selectedPath.startsWith(e.source + "/") ||
          e.source.startsWith(selectedPath + "/");
        const tActive =
          e.target === selectedPath ||
          selectedPath.startsWith(e.target + "/") ||
          e.target.startsWith(selectedPath + "/");
        const isActiveEdge = sActive && tActive;

        return {
          ...e,
          style: {
            ...e.style,
            opacity: isActiveEdge ? 1 : 0.05,
            strokeWidth: isActiveEdge ? 2.5 : 1,
            stroke: isActiveEdge ? "#94a3b8" : "#1e293b",
          },
        };
      }),
    );
  }, [selectedPath, setNodes, setEdges]);

  if (nodes.length === 0) return null;

  return (
    <div className="w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-white/5 bg-[#0a0a0a] relative">
      {/* Helper text */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-[10px] font-mono text-slate-400 bg-black/40 px-3 py-1.5 rounded border border-white/5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Click any folder/file to isolate path
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => setSelectedPath(node.id)}
        onPaneClick={() => setSelectedPath(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.1, maxZoom: 1.5 }}
        className="bg-[#0e0e0e]"
      >
        <Background color="#222" gap={16} />
        {/* 🔥 FIX 1: Overhauled Controls Styling 🔥 */}
        <Controls
          className="!bg-[#141414] !rounded-lg overflow-hidden border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] [&>button]:!bg-[#141414] [&>button]:!border-b-white/10 [&>button>svg]:!fill-slate-400 hover:[&>button>svg]:!fill-white hover:[&>button]:!bg-white/5 transition-all"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
