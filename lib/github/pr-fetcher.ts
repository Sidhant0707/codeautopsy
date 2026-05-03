// lib/github/pr-fetcher.ts

/**
 * Parses a GitHub PR URL and fetches the specific files modified in that PR.
 * Example URL: https://github.com/Sidhant0707/codeautopsy/pull/1
 */
export async function getPullRequestDiff(prUrl: string, token?: string) {
  // 1. Extract owner, repo, and PR number from the URL
  const regex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = prUrl.match(regex);

  if (!match) {
    throw new Error("Invalid GitHub Pull Request URL.");
  }

  const [, owner, repo, pullNumber] = match;

  // 2. Setup headers (Auth is crucial to avoid rate limits)
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 3. Fetch the files changed in this specific PR
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`;
  
  const response = await fetch(apiUrl, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
  }

  const files = await response.json();

  // 4. Map the response to just the data we care about
  const modifiedFiles = files.map((file: any) => ({
    filename: file.filename,     // e.g., "app/page.tsx"
    status: file.status,         // "modified", "added", "removed"
    additions: file.additions,
    changes: file.changes,
  }));

  return {
    owner,
    repo,
    pullNumber,
    modifiedFiles
  };
}