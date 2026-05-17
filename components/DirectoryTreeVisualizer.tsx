"use client";

import React, { useMemo, useState, useEffect, memo } from "react";
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
import { FolderOpen, FileCode, Network } from "lucide-react";

interface DirectoryNode {
  name: string;
  path: string;
  isFolder: boolean;
  themeIndex: number;
  children?: DirectoryNode[];
}

interface TreeNodeData {
  name: string;
  isFolder: boolean;
  themeIndex: number;
  isDimmed: boolean;
}

// --- PRINCIPAL UPGRADE: Safe Tailwind Themes ---
// Prevents Tailwind from purging dynamic classes and adds premium styling
const NODE_THEMES = [
  {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
  },
  {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    dot: "bg-purple-500",
  },
  {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
  },
  {
    text: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
    dot: "bg-pink-500",
  },
  {
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    dot: "bg-cyan-500",
  },
  {
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    dot: "bg-rose-500",
  },
];

const DEFAULT_THEME = {
  text: "text-slate-300",
  bg: "bg-slate-500/10",
  border: "border-slate-500/30",
  dot: "bg-slate-500",
};

// --- PRINCIPAL UPGRADE: Memoized Premium Node ---
const TreeNode = memo(({ data }: { data: TreeNodeData }) => {
  const theme = data.isFolder
    ? DEFAULT_THEME
    : NODE_THEMES[data.themeIndex % NODE_THEMES.length];

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border bg-[#0e0e0e]/80 backdrop-blur-md transition-all duration-300 cursor-crosshair shadow-lg ${
        data.isDimmed
          ? "opacity-30 grayscale border-transparent"
          : `opacity-100 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] ${theme.border}`
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!opacity-0 !w-full !h-full !absolute !z-0 !bg-transparent !border-none"
      />

      <div
        className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${theme.dot}`}
      />

      {data.isFolder ? (
        <FolderOpen
          className={`w-3.5 h-3.5 ${data.isDimmed ? "text-slate-600" : "text-slate-400"}`}
        />
      ) : (
        <FileCode
          className={`w-3.5 h-3.5 ${data.isDimmed ? "text-slate-600" : theme.text}`}
        />
      )}

      <div
        className={`font-mono text-xs whitespace-nowrap transition-colors ${
          data.isDimmed
            ? "text-slate-600"
            : data.isFolder
              ? "text-slate-300 font-bold"
              : "text-slate-200"
        }`}
      >
        {data.name}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!opacity-0 !w-full !h-full !absolute !z-0 !bg-transparent !border-none"
      />
    </div>
  );
});
TreeNode.displayName = "TreeNode";

export default function DirectoryTreeVisualizer({
  metrics,
}: {
  metrics: { path: string; size: number }[];
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const nodeTypes = useMemo(() => ({ treeNode: TreeNode }), []);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!metrics || metrics.length === 0)
      return { initialNodes: [], initialEdges: [] };

    const rootNode: DirectoryNode = {
      name: "root",
      path: "root",
      isFolder: true,
      themeIndex: 0,
      children: [],
    };

    let themeCounter = 0;
    const folderThemeMap = new Map<string, number>();

    metrics.forEach((metric) => {
      const parts = metric.path.split("/");
      let currentLevel = rootNode.children!;
      let currentPath = "root";

      parts.forEach((part, index) => {
        currentPath = `${currentPath}/${part}`;
        const isFile = index === parts.length - 1;
        let existing = currentLevel.find((n) => n.name === part);

        if (!existing) {
          const topFolder = parts.length > 1 ? parts[0] : "root";
          if (!folderThemeMap.has(topFolder)) {
            folderThemeMap.set(topFolder, themeCounter);
            themeCounter++;
          }
          existing = {
            name: part,
            path: currentPath,
            isFolder: !isFile,
            themeIndex: folderThemeMap.get(topFolder) || 0,
            children: isFile ? undefined : [],
          };
          currentLevel.push(existing);
        }
        if (!isFile && existing.children) {
          currentLevel = existing.children;
        }
      });
    });

    const d3Root = hierarchy(rootNode);
    // Adjusted nodeSize to give more breathing room for the new wider premium nodes
    const treeLayout = tree<DirectoryNode>().nodeSize([45, 300]);
    treeLayout(d3Root);

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
          themeIndex: node.data.themeIndex,
          isDimmed: false,
        },
      });
    });

    d3Root.links().forEach((link) => {
      rfEdges.push({
        id: `e-${link.source.data.path}-${link.target.data.path}`,
        source: link.source.data.path,
        target: link.target.data.path,
        type: "smoothstep", // Keep the structured layout
        animated: false,
        style: { stroke: "#334155", strokeWidth: 1.5, opacity: 0.3 },
        // Add this property to slightly round the sharp 90-degree corners!
        pathOptions: { borderRadius: 12 },
      });
    });

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [metrics]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    if (!selectedPath) {
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, isDimmed: false } })),
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          animated: false,
          style: {
            ...e.style,
            opacity: 0.3,
            strokeWidth: 1.5,
            stroke: "#334155",
          },
        })),
      );
      return;
    }

    setNodes((nds) =>
      nds.map((n) => {
        const isActive =
          n.id === selectedPath ||
          selectedPath.startsWith(n.id + "/") ||
          n.id.startsWith(selectedPath + "/");
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
          // --- PRINCIPAL UPGRADE: Active flow animation on isolated paths ---
          animated: isActiveEdge,
          style: {
            ...e.style,
            opacity: isActiveEdge ? 1 : 0.05,
            strokeWidth: isActiveEdge ? 2.5 : 1,
            stroke: isActiveEdge ? "#10b981" : "#1e293b", // Emerald glow for active flow
          },
        };
      }),
    );
  }, [selectedPath, setNodes, setEdges]);

  // --- PRINCIPAL UPGRADE: Premium Empty State ---
  if (nodes.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#0a0a0a]">
        <Network className="w-8 h-8 text-slate-600 mb-3" />
        <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">
          No directory structure parsed
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-white/5 bg-[#0a0a0a] relative">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-[10px] font-mono text-slate-400 bg-white/[0.02] backdrop-blur-md px-3 py-2 rounded-lg border border-white/5 flex items-center gap-2 shadow-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
          Click any node to isolate dependency path
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
        <Background
          color="#ffffff"
          gap={16}
          size={1}
          style={{ opacity: 0.03 }}
        />
        <Controls
          className="!bg-[#141414] !rounded-lg overflow-hidden border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] [&>button]:!bg-[#141414] [&>button]:!border-b-white/10 [&>button>svg]:!fill-slate-400 hover:[&>button>svg]:!fill-white hover:[&>button]:!bg-white/5 transition-all"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
