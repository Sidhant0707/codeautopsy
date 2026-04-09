const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const headers: HeadersInit = {
  Accept: "application/vnd.github+json",
  ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
};

// Parse owner and repo name from a GitHub URL
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

// Fetch basic repo metadata
export async function fetchRepoMeta(owner: string, repo: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

// Fetch the full file tree in one API call
export async function fetchRepoTree(owner: string, repo: string, branch: string) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

// Fetch content of a single file
export async function fetchFileContent(owner: string, repo: string, path: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Failed to fetch file: ${path}`);
  const data = await res.json();
  // GitHub returns file content as base64
  return Buffer.from(data.content, "base64").toString("utf-8");
}