export const fetcher = async (url: string, repoUrl: string) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl }),
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error || json.message || "An error occurred while fetching the data.");
  }

  return json;
};