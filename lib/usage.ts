// lib/usage.ts

import { SupabaseClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = [
  "sidhantkumar431@gmail.com",
  "sidhantkumar0707@gmail.com",
];

const FREE_DAILY_LIMIT       = 5;
const PRO_DAILY_LIMIT        = 100;
const FREE_DIAGNOSTIC_LIMIT  = 3;
const PRO_DIAGNOSTIC_LIMIT   = Infinity;

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
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) return true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();

  const isPro  = profile?.plan_tier === "pro";
  const limit  = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const total  = await getUsageCount(supabase, userId);
  return total < limit;
}

export async function getDiagnosticCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const startOfDay = today.toISOString();

  const { count, error } = await supabase
    .from("diagnostic_runs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay);

  if (error) console.error("Error checking diagnostic usage:", error);
  return count || 0;
}

export async function checkDiagnosticLimit(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string,
  isPro?: boolean
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
    return { allowed: true, used: 0, limit: PRO_DIAGNOSTIC_LIMIT };
  }

  const limit = isPro ? PRO_DIAGNOSTIC_LIMIT : FREE_DIAGNOSTIC_LIMIT;
  const used  = await getDiagnosticCount(supabase, userId);
  return { allowed: used < limit, used, limit };
}