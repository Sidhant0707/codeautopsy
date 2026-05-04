import { SupabaseClient } from "@supabase/supabase-js";

export function chunkCode(code: string, maxChunkSize = 1000): string[] {
  const chunks = [];
  let currentChunk = "";
  const lines = code.split('\n');

  for (const line of lines) {
    if (currentChunk.length + line.length > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }
  if (currentChunk.trim().length > 0) chunks.push(currentChunk);
  return chunks;
}

export async function processAndStoreCodebase(
  supabase: SupabaseClient,
  repoUrl: string,
  files: { path: string; content: string }[]
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY.");
    return;
  }

  console.log(`🧠 Processing codebase in safe batches...`);

  const allChunks: { repo_url: string; file_path: string; content: string }[] = [];
  for (const file of files) {
    const chunks = chunkCode(file.content);
    for (const chunk of chunks) {
      allChunks.push({ repo_url: repoUrl, file_path: file.path, content: chunk });
    }
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);

    const requests = batch.map(b => ({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: b.content }] }
    }));

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests })
      });

      if (!res.ok) {
        console.error("Gemini API Error:", await res.text());
        continue; 
      }

      const embeddingData = await res.json();

      const dbPayload = batch.map((item, index) => ({
        ...item,
        embedding: embeddingData.embeddings[index].values
      }));

      const { error } = await supabase.from('codebase_embeddings').insert(dbPayload);
      if (error) console.error("Supabase Save Error:", error);

    } catch (err) {
      console.error("Network or fetch error:", err);
    }
  }

  console.log(`✅ Finished vectorizing ${repoUrl}`);
}