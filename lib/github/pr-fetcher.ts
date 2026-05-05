


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

  
  const modifiedFiles = files.map((file: any) => ({
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