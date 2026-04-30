// lib/github.ts

// Helper to create headers dynamically
// If a user token is provided, we use it. Otherwise, we fall back to the system GITHUB_TOKEN.
function getHeaders(userToken?: string) {
  const token = userToken || process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };
  
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  
  return headers;
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    // 1. Handle shorthand "owner/repo" format
    if (!url.startsWith("http") && url.includes("/")) {
      const parts = url.split("/");
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
      }
    }

    // 2. Handle standard URLs
    const parsed = new URL(url);
    const parts = parsed.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    if (parts.length < 2) return null;
    
    // Strip .git just in case they copied the clone URL
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

// Added token parameter to all fetch functions
export async function fetchRepoMeta(owner: string, repo: string, token?: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { 
    headers: getHeaders(token) 
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function fetchRepoTree(owner: string, repo: string, branch: string, token?: string) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: getHeaders(token) }
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token?: string
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers: getHeaders(token) }
  );

  if (!res.ok) throw new Error(`Failed to fetch file: ${path}`);

  const data = await res.json();

  if (!data || data.type !== "file" || !data.content) {
    throw new Error(`Invalid file response for ${path}`);
  }

  return Buffer.from(data.content, "base64").toString("utf-8");
}