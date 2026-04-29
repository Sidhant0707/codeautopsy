// lib/debug/mermaid-highlighter.ts

import { TraversalNode } from "./types";

export function highlightDebugPath(
  originalMermaid: string,
  crashNode: string,
  traversalPath: TraversalNode[],
  rootCauseFile?: string
): string {
  let enhanced = originalMermaid;

  // Sanitize file paths to match Mermaid IDs
  const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, "_");

  const crashId = sanitize(crashNode);
  const rootCauseId = rootCauseFile ? sanitize(rootCauseFile) : null;

  // Add styling at the end of the Mermaid definition
  const styles: string[] = [];

  // Style 1: Crash node (red)
  styles.push(
    `style ${crashId} fill:#ff4444,stroke:#cc0000,stroke-width:3px,color:#fff`
  );

  // Style 2: Traversal path (orange gradient by distance)
  traversalPath.forEach((node) => {
    const id = sanitize(node.file);
    if (id === crashId) return; // Already styled

    const opacity = Math.max(0.3, 1 - node.distance * 0.2);
    const color = node.relationship === "upstream" ? "#ff9933" : "#3399ff";
    styles.push(`style ${id} fill:${color},opacity:${opacity}`);
  });

  // Style 3: Root cause (if identified and different from crash)
  if (rootCauseId && rootCauseId !== crashId) {
    styles.push(
      `style ${rootCauseId} fill:#ffaa00,stroke:#ff6600,stroke-width:2px`
    );
  }

  // Inject styles into Mermaid string
  enhanced += "\n\n" + styles.join("\n");

  // Add legend
  enhanced += `
  
subgraph Legend
  direction LR
  crash["🔴 Crash Site"]
  upstream["🟠 Upstream Caller"]
  downstream["🔵 Downstream Dependency"]
end`;

  return enhanced;
}

// Generate a simplified error-focused graph (alternative to highlighting)
export function generateErrorGraph(
  crashNode: string,
  traversalPath: TraversalNode[]
): string {
  const lines: string[] = ["graph TD"];

  const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, "_");

  // Crash node
  const crashId = sanitize(crashNode);
  const crashName = crashNode.split("/").pop() || crashNode;
  lines.push(`  ${crashId}["🔴 ${crashName}"]`);
  lines.push(
    `  style ${crashId} fill:#ff4444,stroke:#cc0000,stroke-width:3px,color:#fff`
  );

  // Add top 10 nodes
  const topNodes = traversalPath.slice(0, 10);

  topNodes.forEach((node) => {
    const id = sanitize(node.file);
    const name = node.file.split("/").pop() || node.file;
    const icon = node.relationship === "upstream" ? "⬆️" : "⬇️";

    lines.push(`  ${id}["${icon} ${name}"]`);

    // Add edge
    if (node.relationship === "upstream") {
      lines.push(`  ${id} --> ${crashId}`);
    } else {
      lines.push(`  ${crashId} --> ${id}`);
    }

    // Style by relationship
    const color = node.relationship === "upstream" ? "#ff9933" : "#3399ff";
    lines.push(`  style ${id} fill:${color},opacity:0.7`);
  });

  return lines.join("\n");
}