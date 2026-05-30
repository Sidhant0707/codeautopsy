import { SupabaseClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = [
  "sidhantkumar431@gmail.com",
  "sidhantkumar0707@gmail.com",
];

const FREE_DAILY_LIMIT = 5;
const PRO_DAILY_LIMIT = 100;

export async function getUsageCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const startOfDay = today.toISOString();

  const { count: repoCount, error: repoError } = await supabase
    .from("analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay);

  if (repoError) console.error("Error checking repo usage:", repoError);

  const { count: prCount, error: prError } = await supabase
    .from("pr_analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay);

  if (prError) console.error("Error checking PR usage:", prError);

  return (repoCount || 0) + (prCount || 0);
}

export async function checkUsageLimit(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string
): Promise<boolean> {
  // Admins always bypass
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
    console.log(`🛡️ Admin bypass active for: ${userEmail}`);
    return true;
  }

  // Check plan tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();

  const isPro = profile?.plan_tier === "pro";
  const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;

  const totalUsage = await getUsageCount(supabase, userId);
  return totalUsage < limit;
}