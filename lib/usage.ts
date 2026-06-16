// lib/usage.ts

import { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_EMAILS,
  FREE_DAILY_LIMIT,
  PRO_DAILY_LIMIT,
  FREE_DIAGNOSTIC_LIMIT,
  PRO_DIAGNOSTIC_LIMIT,
  AI_FREE_LIMIT,
} from "@/lib/constants";

export function isAdmin(userEmail?: string): boolean {
  return !!userEmail && ADMIN_EMAILS.includes(userEmail);
}

export async function getAiUsageCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("ai_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) console.error("[ai-usage] Error fetching count:", error.message);
  return count ?? 0;
}

export async function checkAiUsageLimit(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (isAdmin(userEmail)) return { allowed: true, used: 0, limit: AI_FREE_LIMIT };

  const used = await getAiUsageCount(supabase, userId);
  return { allowed: used < AI_FREE_LIMIT, used, limit: AI_FREE_LIMIT };
}

export async function insertAiUsage(
  supabase: SupabaseClient,
  userId: string,
  repoUrl: string
): Promise<void> {
  const { error } = await supabase
    .from("ai_usage")
    .insert({ user_id: userId, repo_url: repoUrl });

  if (error) console.error("[ai-usage] Error inserting usage:", error.message);
}

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

  return (repoCount ?? 0) + (prCount ?? 0);
}

export async function checkUsageLimit(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string
): Promise<boolean> {
  if (isAdmin(userEmail)) return true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();

  const isPro = profile?.plan_tier === "pro";
  const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const total = await getUsageCount(supabase, userId);
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
    .from("debug_analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay);

  if (error) console.error("Error checking diagnostic usage:", error);
  return count ?? 0;
}

export async function checkDiagnosticLimit(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (isAdmin(userEmail)) {
    return { allowed: true, used: 0, limit: PRO_DIAGNOSTIC_LIMIT };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();

  const isPro  = profile?.plan_tier === "pro";
  const limit  = isPro ? PRO_DIAGNOSTIC_LIMIT : FREE_DIAGNOSTIC_LIMIT;
  const used   = await getDiagnosticCount(supabase, userId);
  return { allowed: used < limit, used, limit };
}