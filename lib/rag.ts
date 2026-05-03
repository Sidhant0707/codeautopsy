import { SupabaseClient } from "@supabase/supabase-js";

// Chops massive code files into ~1000 character chunks so the AI can digest them
function chunkCode(code: string, maxChunkSize = 1000): string[] {
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
  const apiKey = process.env.GEMINI_API_KEY; // ✨ Using the free key!
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY. Cannot generate embeddings.");
    return;
  }

  console.log(`🧠 Processing Free Gemini RAG embeddings for ${repoUrl}...`);

  const allChunks: { repo_url: string; file_path: string; content: string }[] = [];

  for (const file of files) {
    const chunks = chunkCode(file.content);
    for (const chunk of chunks) {
      allChunks.push({
        repo_url: repoUrl,
        file_path: file.path,
        content: chunk
      });
    }
  }

  // We process in batches of 100 to stay within free API limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);

    // Format the payload for the stable embedding-001 model
    const requests = batch.map(b => ({
      model: "models/embedding-001",
      content: { parts: [{ text: b.content }] }
    }));

    // 1. Turn the code chunks into vectors using Gemini's stable model
    // 1. Turn the code chunks into vectors using Gemini's stable V1 API
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/embedding-001:batchEmbedContents?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests })
    });
    if (!res.ok) {
       console.error("Gemini Embedding generation failed", await res.text());
       continue;
    }

    const embeddingData = await res.json();

    // 2. Attach the 768-dimensional math vectors to your code chunks
    const dbPayload = batch.map((item, index) => ({
      ...item,
      embedding: embeddingData.embeddings[index].values
    }));

    // 3. Save directly to your new Supabase Vector table
    const { error } = await supabase.from('codebase_embeddings').insert(dbPayload);
    if (error) {
      console.error("Failed to save vectors to Supabase", error);
    }
  }
  
  console.log(`✅ Finished vectorizing ${repoUrl} for FREE`);
}