


export async function getPullRequestDiff(prUrl: string, token?: string) {
  
  const regex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = prUrl.match(regex);

  if (!match) {
    throw new Error("Invalid GitHub Pull Request URL.");
  }

  const [, owner, repo, pullNumber] = match;

  
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`;
  
  const response = await fetch(apiUrl, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
  }

  const files = await response.json();

  
  interface GitHubFile {
    filename: string;
    status: string;
    additions: number;
    changes: number;
  }

  const modifiedFiles = files.map((file: GitHubFile) => ({
    filename: file.filename,     
    status: file.status,         
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
export async function getFileContributors(owner: string, repo: string, path: string, token?: string) {
  const headers: Record<string, string> = { 
    Accept: "application/vnd.github.v3+json" 
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=10`, 
      { headers }
    );
    
    if (!res.ok) return [];
    
    const commits = await res.json();
    const authorCounts: Record<string, number> = {};
    
    commits.forEach((c: { author?: { login?: string } }) => {
      const login = c.author?.login;
      if (login) {
        authorCounts[login] = (authorCounts[login] || 0) + 1;
      }
    });

    return Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([login, count]) => `${login} (${count} recent commits)`);
  } catch {
    return [];
  }
}