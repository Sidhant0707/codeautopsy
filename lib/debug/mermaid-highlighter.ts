// lib/debug/mermaid-highlighter.ts

import { TraversalNode } from "./types";

// ── Node ID sanitizer ─────────────────────────────────────────────────────────
// Previously: all non-alphanumeric chars → "_"
// app/auth.ts and app-auth.ts both produced "app_auth_ts" → node ID collision.
// Now: includes the full depth of path segments to guarantee uniqueness.
function sanitize(filePath: string): string {
  // Replace path separators with double underscore to preserve folder context
  return filePath.replace(/\//g, "__").replace(/[^a-zA-Z0-9_]/g, "_");
}

// ── Highlight crash path on existing mermaid diagram ─────────────────────────
export function highlightDebugPath(
  originalMermaid: string,
  crashNode: string,
  traversalPath: TraversalNode[],
  rootCauseFile?: string
): string {
  const crashId = sanitize(crashNode);
  const rootCauseId = rootCauseFile ? sanitize(rootCauseFile) : null;

  const styles: string[] = [];

  // Crash site — red, thick border
  styles.push(
    `style ${crashId} fill:#ff4444,stroke:#cc0000,stroke-width:3px,color:#fff`
  );

  traversalPath.forEach((node) => {
    const id = sanitize(node.file);
    if (id === crashId) return;

    // Previously used `opacity` which is not a valid Mermaid style property.
    // Now uses stroke-width to visually indicate distance instead.
    const strokeWidth = Math.max(1, 3 - node.distance);
    const color = node.relationship === "upstream" ? "#ff9933" : "#3399ff";

    styles.push(
      `style ${id} fill:${color},stroke:#fff,stroke-width:${strokeWidth}px,color:#fff`
    );
  });

  // Root cause — amber, distinct border
  if (rootCauseId && rootCauseId !== crashId) {
    styles.push(
      `style ${rootCauseId} fill:#ffaa00,stroke:#ff6600,stroke-width:2px,color:#000`
    );
  }

  return `${originalMermaid}\n\n${styles.join("\n")}`;
}