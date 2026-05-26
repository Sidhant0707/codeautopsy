import { createHash, randomBytes } from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export function generateApiKey(): { raw: string; hash: string } {
  const raw = "cak_" + randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export async function validateApiKey(raw: string) {
  const hash = createHash("sha256").update(raw).digest("hex");

    console.log("\n[DEBUG] Node.js hash :", hash);
  console.log("[DEBUG] Expected hash :", "eb310c5fa36b268b1f070502a90d0b2b6ca09fb969596c8f2efe9325c246810b");
  console.log("[DEBUG] Match         :", hash === "eb310c5fa36b268b1f070502a90d0b2b6ca09fb969596c8f2efe9325c246810b");

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      `[api-keys] Missing env vars — URL: ${!!url}, SERVICE_KEY: ${!!serviceKey}`,
    );
  }

  const supabaseAdmin = createAdminClient(url, serviceKey);

  // ✅ Single declaration — both data AND error destructured
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, is_active")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .single();

  if (error) {
    // PGRST116 = no rows found — normal for an invalid key, not a crash
    if (error.code !== "PGRST116") {
      console.error("\n[api-keys] Supabase query error:", error.code, error.message);
      console.error("[api-keys] Hash queried:", hash, "\n");
    }
    return null;
  }

  if (data) {
    // Fire-and-forget timestamp update — failures are logged, not thrown
    supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error("[api-keys] Failed to update last_used_at:", updateError.message);
        }
      });
  }

  return data ?? null;
}