import { SupabaseClient } from "@supabase/supabase-js";

export const AI_FREE_LIMIT = 3;

const ADMIN_EMAILS = [
  "sidhantkumar431@gmail.com",
  "sidhantkumar0707@gmail.com",
];

export async function getAiUsageCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("ai_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("[ai-usage] Error fetching count:", error.message);
    return 0;
  }

  return count ?? 0;
}

export async function checkAiUsageLimit(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
    return { allowed: true, used: 0, limit: AI_FREE_LIMIT };
  }

  const used = await getAiUsageCount(supabase, userId);
  return {
    allowed: used < AI_FREE_LIMIT,
    used,
    limit: AI_FREE_LIMIT,
  };
}

export async function insertAiUsage(
  supabase: SupabaseClient,
  userId: string,
  repoUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from("ai_usage")
    .insert({ user_id: userId, repo_url: repoUrl });

  if (error) {
    console.error("[ai-usage] Error inserting usage:", error.message);
  }
}