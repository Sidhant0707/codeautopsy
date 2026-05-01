function getHeaders(userToken?: string) {
  const token = userToken || process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  return headers;
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    if (!url.startsWith("http") && url.includes("/")) {
      const parts = url.split("/");
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
      }
    }

    const parsed = new URL(url);
    const parts = parsed.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    if (parts.length < 2) return null;
    
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

export async function fetchRepoMeta(
  owner: string,
  repo: string,
  token?: string
): Promise<any> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(url, { headers });

  if (res.status === 404) {
    // If 404 AND no token provided, it might be a private repo
    if (!token) {
      throw new GitHubAuthError('REQUIRE_GITHUB_AUTH');
    }
    // If 404 WITH token, repo genuinely doesn't exist or no access
    throw new Error('Repository not found or you do not have access');
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

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