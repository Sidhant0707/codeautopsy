// lib/github/commits.ts

// ─────────────────────────────────────────────────────────────────────────────
// CodeAutopsy · GitHub Commit Pipeline
// Fetches the last N commits for a repo and returns, per commit, the list of
// file paths that were changed.  Designed to be called exclusively server-side
// (Server Actions / Route Handlers) so the token is never exposed to the client.
//
// Constraints honoured:
//   • GitHub primary rate limit  → tracked via X-RateLimit-* response headers;
//     the caller blocks until the window resets before retrying.
//   • GitHub secondary rate limit → detected via 403 + "secondary rate limit"
//     body OR via Retry-After header on 429; backs off for the indicated period.
//   • Concurrency              → a Semaphore caps simultaneous in-flight detail
//     requests so we never hammer GitHub with 200 parallel calls.
//   • Truncated commits        → GitHub silently caps `files[]` at 300 entries.
//     We detect this and skip the commit to avoid skewing coupling data.
// ─────────────────────────────────────────────────────────────────────────────

const GITHUB_API_BASE = "https://api.github.com";

// ─── Public option / return types ────────────────────────────────────────────

export interface FetchCommitsOptions {
  /** GitHub repo owner (user or org). */
  owner: string;
  /** GitHub repo name. */
  repo: string;
  /**
   * Personal Access Token or fine-grained token with at minimum `contents: read`
   * on the target repo.  Public repos work without a token but burn the 60 req/h
   * unauthenticated limit extremely fast; always pass a token.
   */
  token: string;
  /**
   * How many commits to walk.  Clamped to [1, 200].
   * @default 100
   */
  maxCommits?: number;
  /**
   * Max simultaneous in-flight detail fetches.  Keep ≤ 10 to stay well inside
   * GitHub's concurrency secondary-rate-limit.
   * @default 6
   */
  concurrency?: number;
  /**
   * Branch / tag / SHA to start from.  Omit to use the repo's default branch.
   */
  branch?: string;
}

/** Each element is the set of file paths changed in one commit. */
export type CommitFileMatrix = string[][];

// ─── Internal types ───────────────────────────────────────────────────────────

interface RateLimitState {
  /** Requests remaining in the current window. */
  remaining: number;
  /** Unix epoch (seconds) when the window resets. */
  reset: number;
  /**
   * Non-null while we are in a secondary-rate-limit back-off.
   * Value is the number of ms to wait.
   */
  retryAfterMs: number | null;
}

interface GhCommitListItem {
  sha: string;
}

interface GhCommitFile {
  filename: string;
  status:
    | "added"
    | "removed"
    | "modified"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
  previous_filename?: string;
}

interface GhCommitDetail {
  sha: string;
  files?: GhCommitFile[];
}

// ─── Semaphore ────────────────────────────────────────────────────────────────

/**
 * A classic promise-based counting semaphore.
 * `run()` is the only public API consumers need; acquire/release are internal.
 */
class Semaphore {
  private permits: number;
  private readonly waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    if (permits < 1) throw new RangeError("Semaphore permits must be ≥ 1");
    this.permits = permits;
  }

  private acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waitQueue.push(resolve));
  }

  private release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      // Pass the permit directly to the next waiter — no increment needed.
      next();
    } else {
      this.permits++;
    }
  }

  /** Acquire → run fn → release, even if fn throws. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Milliseconds until the rate-limit window resets, plus a 1 s buffer. */
function msUntilReset(resetEpochSeconds: number): number {
  const nowMs = Date.now();
  const resetMs = resetEpochSeconds * 1_000;
  return Math.max(0, resetMs - nowMs) + 1_000; // 1 s safety buffer
}

const SECONDARY_RATE_LIMIT_PATTERN = /secondary rate limit/i;
const RETRYABLE_HTTP_STATUS = new Set([500, 502, 503, 504]);
const MAX_RETRIES = 4;

// ─── Rate-limit-aware fetch ───────────────────────────────────────────────────

/**
 * Wrapper around `fetch` that:
 *   1. Proactively waits when the primary rate limit is exhausted.
 *   2. Detects secondary-rate-limit responses (403 / 429) and backs off.
 *   3. Retries transient server errors with exponential back-off.
 *   4. Updates the shared `RateLimitState` from every response.
 */
async function githubFetch(
  url: string,
  token: string,
  rls: RateLimitState
): Promise<Response> {
  // ── Pre-flight: secondary back-off ───────────────────────────────────────
  if (rls.retryAfterMs !== null) {
    await sleep(rls.retryAfterMs);
    rls.retryAfterMs = null;
  }

  // ── Pre-flight: primary rate-limit exhausted ─────────────────────────────
  if (rls.remaining <= 0) {
    await sleep(msUntilReset(rls.reset));
  }

  let lastErr: Error = new Error("Unknown fetch error");

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential back-off: 2 s, 4 s, 8 s
      await sleep(Math.pow(2, attempt) * 1_000);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          // Disable Next.js fetch cache — we always want live data from GitHub.
          "Cache-Control": "no-store",
        },
        // Node ≥ 18 fetch accepts `cache` option; Next.js also respects it.
        cache: "no-store",
      });
    } catch (networkErr) {
      lastErr =
        networkErr instanceof Error ? networkErr : new Error(String(networkErr));
      continue; // Retry on network-level failures
    }

    // ── Update shared rate-limit state ─────────────────────────────────────
    const hRemaining = res.headers.get("X-RateLimit-Remaining");
    const hReset = res.headers.get("X-RateLimit-Reset");
    if (hRemaining !== null) rls.remaining = parseInt(hRemaining, 10);
    if (hReset !== null) rls.reset = parseInt(hReset, 10);

    if (res.ok) return res;

    // ── 403 / 429 — rate limiting ──────────────────────────────────────────
    if (res.status === 403 || res.status === 429) {
      const retryAfterHeader = res.headers.get("Retry-After");

      if (retryAfterHeader !== null) {
        // Explicit back-off duration (seconds)
        rls.retryAfterMs = parseInt(retryAfterHeader, 10) * 1_000 + 500;
        await sleep(rls.retryAfterMs);
        rls.retryAfterMs = null;
        continue;
      }

      // 403 without Retry-After could be secondary rate limit or auth error.
      // Peek at body to distinguish.
      let body = "";
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }

      if (SECONDARY_RATE_LIMIT_PATTERN.test(body)) {
        // GitHub recommends waiting at least 1 minute for secondary limits.
        rls.retryAfterMs = 60_000 + 1_000;
        await sleep(rls.retryAfterMs);
        rls.retryAfterMs = null;
        continue;
      }

      if (rls.remaining <= 0) {
        // Primary limit exhausted — wait for reset.
        await sleep(msUntilReset(rls.reset));
        continue;
      }

      // Hard auth error (bad token, missing scope) — no point retrying.
      throw new Error(
        `GitHub returned 403 for ${url}. Check token scopes. Body: ${body}`
      );
    }

    // ── 5xx transient server errors ────────────────────────────────────────
    if (RETRYABLE_HTTP_STATUS.has(res.status)) {
      lastErr = new Error(`GitHub API ${res.status} at ${url}`);
      continue;
    }

    // ── Non-retryable client error ─────────────────────────────────────────
    let errBody = "";
    try {
      errBody = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(
      `GitHub API non-retryable error ${res.status} at ${url}: ${errBody}`
    );
  }

  throw new Error(
    `GitHub API failed after ${MAX_RETRIES} attempts for ${url}: ${lastErr.message}`
  );
}

// ─── Step 1: Fetch commit SHA list ────────────────────────────────────────────

async function fetchCommitSHAs(
  owner: string,
  repo: string,
  token: string,
  maxCommits: number,
  branch: string | undefined,
  rls: RateLimitState
): Promise<string[]> {
  const shas: string[] = [];
  const perPage = 100; // GitHub max per-page for this endpoint
  const totalPages = Math.ceil(maxCommits / perPage);

  for (let page = 1; page <= totalPages; page++) {
    if (shas.length >= maxCommits) break;

    const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
    if (branch) params.set("sha", branch);

    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?${params}`;
    const res = await githubFetch(url, token, rls);
    const items: GhCommitListItem[] = await res.json();

    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      if (shas.length >= maxCommits) break;
      if (item.sha) shas.push(item.sha);
    }
  }

  return shas;
}

// ─── Step 2: Fetch files for one commit ──────────────────────────────────────

/**
 * GitHub caps `files[]` at exactly 300 items without a truncation flag.
 * Any commit touching ≥ 300 files is a mass refactor / generated-file dump —
 * including it would poison coupling data, so we return null to signal "skip".
 */
const GH_MAX_FILES_PER_COMMIT = 300;

async function fetchFilesForCommit(
  owner: string,
  repo: string,
  sha: string,
  token: string,
  rls: RateLimitState
): Promise<string[] | null> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`;
  const res = await githubFetch(url, token, rls);
  const detail: GhCommitDetail = await res.json();
  const files = detail.files ?? [];

  if (files.length >= GH_MAX_FILES_PER_COMMIT) return null; // likely truncated

  return files
    .filter((f) => f.status !== "removed") // deleted files are irrelevant for coupling
    .map((f) =>
      // For renamed files, use the NEW filename so it aligns with the
      // current dependencyGraph topology rather than a stale identity.
      f.filename
    );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Fetches up to `maxCommits` commits and returns, per commit, the list of
 * file paths that were **added, modified, or renamed** in that commit.
 *
 * Commits are returned in the same chronological order GitHub returns them
 * (newest-first).  Only commits that changed ≥ 2 files are included, since
 * single-file commits contribute nothing to coupling analysis.
 *
 * @example
 * ```ts
 * const commits = await fetchLogicalCouplingCommits({
 *   owner: "vercel",
 *   repo:  "next.js",
 *   token: process.env.GITHUB_TOKEN!,
 *   maxCommits:  200,
 *   concurrency: 8,
 * });
 * // commits[0] → ["packages/next/src/server/app-render.tsx", "packages/next/src/server/render.tsx", ...]
 * ```
 */
export async function fetchLogicalCouplingCommits(
  options: FetchCommitsOptions
): Promise<CommitFileMatrix> {
  const {
    owner,
    repo,
    token,
    maxCommits = 100,
    concurrency = 6,
    branch,
  } = options;

  const clampedMax = Math.min(Math.max(maxCommits, 1), 200);

  const rls: RateLimitState = {
    remaining: 5_000, // optimistic default; updated on first response
    reset: Math.floor(Date.now() / 1_000) + 3_600,
    retryAfterMs: null,
  };

  // ── Step 1: Collect SHAs (1–2 API calls) ──────────────────────────────────
  const shas = await fetchCommitSHAs(owner, repo, token, clampedMax, branch, rls);

  // ── Step 2: Fetch file lists in parallel, bounded by Semaphore ────────────
  const semaphore = new Semaphore(concurrency);
  const matrix: Array<string[] | null> = new Array(shas.length).fill(null);

  await Promise.all(
    shas.map((sha, idx) =>
      semaphore.run(async () => {
        try {
          matrix[idx] = await fetchFilesForCommit(owner, repo, sha, token, rls);
        } catch {
          // Non-fatal: a single failed commit detail fetch should not abort the
          // entire pipeline.  Log in development; silently skip in production.
          if (process.env.NODE_ENV === "development") {
            console.warn(`[CodeAutopsy] Could not fetch files for commit ${sha}`);
          }
          matrix[idx] = null;
        }
      })
    )
  );

  // ── Step 3: Filter nulls and single-file commits ───────────────────────────
  return matrix.filter(
    (files): files is string[] => files !== null && files.length >= 2
  );
}