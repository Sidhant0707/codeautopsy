"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSystemTelemetry() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {} // Read-only action, no need to set cookies
      },
    }
  );

  // Get total feedback count
  const { count: totalVotes, error: totalError } = await supabase
    .from("debug_feedback")
    .select("*", { count: "exact", head: true });

  // Get successful (thumbs up) count
  const { count: upVotes, error: upError } = await supabase
    .from("debug_feedback")
    .select("*", { count: "exact", head: true })
    .eq("is_helpful", true);

  if (totalError || upError || totalVotes === 0 || totalVotes === null) {
    return { successRate: 0, totalScans: 0 };
  }

  const successRate = Math.round(((upVotes || 0) / totalVotes) * 100);
  
  return { 
    successRate, 
    totalScans: totalVotes 
  };
}