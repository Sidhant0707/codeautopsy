import { SupabaseClient } from "@supabase/supabase-js";

// ✨ 1. Define your admin accounts (God Mode)
const ADMIN_EMAILS = [
  "sidhantkumar431@gmail.com", 
  "sidhantkumar0707@gmail.com",
];

export async function checkUsageLimit(
  supabase: SupabaseClient, 
  userId: string, 
  userEmail?: string
): Promise<boolean> {
  
  // ✨ 2. The Admin Bypass Shield
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
    console.log(`🛡️ Admin bypass active for: ${userEmail}`);
    return true; // Instantly grant unlimited access!
  }

  const MAX_DAILY_SCANS = 10;
  
  // Get midnight of the current day in UTC
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const startOfDay = today.toISOString();

  // Count Repo Scans today
  const { count: repoCount, error: repoError } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay);

  if (repoError) console.error("Error checking repo usage:", repoError);

  // Count PR Scans today
  const { count: prCount, error: prError } = await supabase
    .from('pr_analyses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay);

  if (prError) console.error("Error checking PR usage:", prError);

  const totalUsage = (repoCount || 0) + (prCount || 0);

  // Return true if they are under the limit, false if they hit it
  return totalUsage < MAX_DAILY_SCANS;
}