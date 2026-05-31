// lib/algorithms/implicitCoupling.ts

// ─────────────────────────────────────────────────────────────────────────────
// CodeAutopsy · Implicit Coupling Math Engine
//
// Computes "logical coupling" (co-change probability) from raw git history.
// Surfaces file pairs that change together frequently but share NO explicit
// import edge — these are the "hidden ghost edges" rendered in React Flow.
//
// Algorithm: Association Rule Mining (ARM) over a transaction database where
//   • each "transaction"  = one commit
//   • each "item"         = one file path
//
// Metrics produced per pair (A, B):
//   • support          = P(A ∧ B)  = coChangeCount / totalCommits
//   • confidence(A→B)  = P(B | A)  = coChangeCount / totalCommitsWithA
//   • confidence(B→A)  = P(A | B)  = coChangeCount / totalCommitsWithB
//   • jaccard          = coChangeCount / |commitsWithA ∪ commitsWithB|
//                      = coChange / (cA + cB - coChange)
//                      (symmetric; robust to files with very different activity)
//
// Complexity:
//   Pass 1 — file commit counts     : O(M · F)
//   Pass 2 — co-change counts       : O(M · F²)  — F is tiny in practice (≈ 5–15)
//   Pass 3 — dependency edge set    : O(E)
//   Pass 4 — confidence + filter    : O(P)        — P = unique co-change pairs
//   Pass 5 — sort                   : O(P log P)
//
//   Overall: O(M · F²  +  E  +  P log P)
//
// Memory:
//   fileCommitCount : O(N)    — N = unique files across all commits
//   coChangeMap     : O(P)    — P ≤ C(N, 2) but << that in practice
//   existingEdges   : O(E)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Public interfaces ────────────────────────────────────────────────────────

/** One "ghost edge" candidate returned by the engine. */
export interface ImplicitCouplingResult {
  /**
   * File with the higher conditional probability of co-changing with `fileB`.
   * I.e. `confidence >= reverseConfidence` is always true.
   */
  fileA: string;
  /** The coupled counterpart. */
  fileB: string;
  /**
   * P(fileB changes | fileA changes).
   * "When fileA changes, fileB also changes this fraction of the time."
   */
  confidence: number;
  /**
   * P(fileA changes | fileB changes).
   * The reverse direction — often < confidence, but surfaced for directed edges.
   */
  reverseConfidence: number;
  /** Raw count: commits where BOTH files were modified. */
  coChangeCount: number;
  /**
   * Jaccard similarity coefficient — symmetric, range [0, 1].
   * Preferred ranking metric because it penalises files that change in almost
   * every commit (which would inflate raw confidence).
   */
  jaccard: number;
  /**
   * support = coChangeCount / totalCommits.
   * Tells you how globally frequent this coupling is.
   */
  support: number;
}

/** Tuning knobs for the coupling engine. */
export interface CouplingOptions {
  /**
   * Minimum times two files must co-change to be included.
   * Low values (1–2) are noisy; 3+ is recommended for production.
   * @default 3
   */
  minCoChangeCount?: number;
  /**
   * Minimum Jaccard score required.  Range [0, 1].
   * @default 0.1
   */
  minJaccard?: number;
  /**
   * Minimum confidence in the dominant direction.  Range [0, 1].
   * @default 0.1
   */
  minConfidence?: number;
  /**
   * Cap on results returned (sorted by jaccard DESC).
   * 0 means "no cap".
   * @default 500
   */
  maxResults?: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Canonical key for an unordered pair of file paths.
 * Sorting guarantees (A, B) and (B, A) produce the same key.
 *
 * Uses the NUL byte (U+0000) as separator because it is the one character
 * that cannot legally appear in any OS file path.
 */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

/**
 * Decode a canonical pair key back into its two constituent paths.
 * @internal
 */
function splitPairKey(key: string): [string, string] {
  const idx = key.indexOf("\0");
  return [key.slice(0, idx), key.slice(idx + 1)];
}

/**
 * Build a Set of canonical pair keys from the existing dependency graph so we
 * can do O(1) "is this pair already explicit?" lookups in Pass 4.
 *
 * Both directions (A→B and B→A) map to the same canonical key, so a single
 * Set covers undirected filtering.
 *
 * Complexity: O(E) where E = total directed edges in the dependency graph.
 */
function buildExplicitEdgeSet(
  dependencyGraph: Record<string, string[]>
): Set<string> {
  const edges = new Set<string>();
  for (const [source, targets] of Object.entries(dependencyGraph)) {
    for (const target of targets) {
      edges.add(pairKey(source, target));
    }
  }
  return edges;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Computes implicit (logical) coupling between files based on co-change
 * frequency in git history, then **subtracts** any pair already connected by
 * an explicit import edge in `dependencyGraph`.
 *
 * The result is sorted by **Jaccard coefficient** descending — this ranks
 * genuinely tightly-coupled pairs above files that happen to appear in many
 * commits due to bulk churn.
 *
 * @param commits          Output of `fetchLogicalCouplingCommits` — each inner
 *                         array is the file paths changed in one commit.
 * @param dependencyGraph  Existing explicit import graph from your AST pass.
 * @param options          Optional filtering / result-cap configuration.
 *
 * @example
 * ```ts
 * const ghostEdges = computeImplicitCoupling(commits, dependencyGraph, {
 *   minCoChangeCount: 3,
 *   minJaccard:       0.15,
 *   maxResults:       200,
 * });
 *
 * // Render in React Flow:
 * ghostEdges.forEach(({ fileA, fileB, jaccard, confidence }) => {
 *   addGhostEdge(fileA, fileB, { weight: jaccard, label: `${(confidence * 100).toFixed(0)}%` });
 * });
 * ```
 */
export function computeImplicitCoupling(
  commits: string[][],
  dependencyGraph: Record<string, string[]>,
  options: CouplingOptions = {}
): ImplicitCouplingResult[] {
  const {
    minCoChangeCount = 3,
    minJaccard       = 0.1,
    minConfidence    = 0.1,
    maxResults       = 500,
  } = options;

  const totalCommits = commits.length;
  if (totalCommits === 0) return [];

  // ── Pass 1: Per-file commit frequency ─────────────────────────────────────
  // O(M · F)
  // fileCommitCount.get(f) = number of commits in which f appeared.
  const fileCommitCount = new Map<string, number>();

  for (const files of commits) {
    // Deduplicate within the commit — a file can theoretically be listed twice
    // if GitHub returns both a rename source and target for the same path.
    const unique = new Set(files);
    for (const file of unique) {
      fileCommitCount.set(file, (fileCommitCount.get(file) ?? 0) + 1);
    }
  }

  // ── Pass 2: Co-change frequency ───────────────────────────────────────────
  // O(M · F²)
  // coChangeMap.get(pairKey(a, b)) = number of commits containing BOTH a and b.
  //
  // Inner loop: for a commit with F files, we generate C(F, 2) = F(F-1)/2 pairs.
  // Real-world median F ≈ 5 → ≈ 10 pair insertions per commit — very cheap.
  const coChangeMap = new Map<string, number>();

  for (const files of commits) {
    const unique = Array.from(new Set(files));
    const n = unique.length;

    // Pairs are generated in a canonical nested loop; pairKey() handles sorting.
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const key = pairKey(unique[i], unique[j]);
        coChangeMap.set(key, (coChangeMap.get(key) ?? 0) + 1);
      }
    }
  }

  // ── Pass 3: Existing explicit edges ───────────────────────────────────────
  // O(E)
  const explicitEdges = buildExplicitEdgeSet(dependencyGraph);

  // ── Pass 4: Compute metrics and apply filters ─────────────────────────────
  // O(P) where P = coChangeMap.size
  const results: ImplicitCouplingResult[] = [];

  for (const [key, coChangeCount] of coChangeMap) {
    // ── Filter 1: minimum raw co-change count (noise gate) ─────────────────
    if (coChangeCount < minCoChangeCount) continue;

    // ── Filter 2: skip pairs with an existing explicit import edge ──────────
    if (explicitEdges.has(key)) continue;

    const [rawA, rawB] = splitPairKey(key);

    const cA = fileCommitCount.get(rawA) ?? 0;
    const cB = fileCommitCount.get(rawB) ?? 0;

    // Guard: both files must appear in our commit data (should always be true).
    if (cA === 0 || cB === 0) continue;

    // ── Confidence (directed conditional probabilities) ─────────────────────
    const confAB = coChangeCount / cA; // P(B | A)
    const confBA = coChangeCount / cB; // P(A | B)

    // Orient so that fileA is the "dominant" side (higher confidence).
    // This makes fileA → fileB the primary edge direction for React Flow.
    const [fileA, fileB, confidence, reverseConfidence] =
      confAB >= confBA
        ? [rawA, rawB, confAB, confBA]
        : [rawB, rawA, confBA, confAB];

    // ── Filter 3: minimum confidence (dominant direction) ───────────────────
    if (confidence < minConfidence) continue;

    // ── Jaccard similarity ───────────────────────────────────────────────────
    // jaccard = |A ∩ B| / |A ∪ B| = coChange / (cA + cB - coChange)
    // Range: (0, 1].  Symmetric and unaffected by total commit volume.
    const union = cA + cB - coChangeCount;
    const jaccard = coChangeCount / union;

    // ── Filter 4: minimum Jaccard ────────────────────────────────────────────
    if (jaccard < minJaccard) continue;

    results.push({
      fileA,
      fileB,
      confidence,
      reverseConfidence,
      coChangeCount,
      jaccard,
      support: coChangeCount / totalCommits,
    });
  }

  // ── Pass 5: Sort — primary key: jaccard DESC, tiebreak: coChangeCount DESC ─
  // O(P log P)
  results.sort((a, b) =>
    b.jaccard !== a.jaccard
      ? b.jaccard - a.jaccard
      : b.coChangeCount - a.coChangeCount
  );

  // ── Apply result cap ───────────────────────────────────────────────────────
  return maxResults > 0 ? results.slice(0, maxResults) : results;
}

// ─── Utility: enrich ghost edges with display metadata ───────────────────────

/** Display-ready ghost edge for React Flow consumption. */
export interface GhostEdge {
  id: string;
  source: string;
  target: string;
  /** Normalised edge weight in [0, 1] based on Jaccard. */
  weight: number;
  label: string;
  data: ImplicitCouplingResult;
}

/**
 * Converts raw coupling results into React Flow edge descriptors.
 *
 * Useful if you want to pass the list directly to your `<ReactFlow edges={...}`
 * prop without any further transformation in the component layer.
 *
 * @example
 * ```ts
 * const ghostEdges = toGhostEdges(
 *   computeImplicitCoupling(commits, dependencyGraph)
 * );
 * // ghostEdges[0].label → "87% co-change · 14×"
 * ```
 */
export function toGhostEdges(results: ImplicitCouplingResult[]): GhostEdge[] {
  return results.map((r) => ({
    id:     `ghost::${pairKey(r.fileA, r.fileB)}`,
    source: r.fileA,
    target: r.fileB,
    weight: r.jaccard,
    label:  `${(r.confidence * 100).toFixed(0)}% co-change · ${r.coChangeCount}×`,
    data:   r,
  }));
}