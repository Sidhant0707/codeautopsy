"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function submitDiagnosisFeedback(isHelpful: boolean, debugId?: string) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in server actions
          }
        },
      },
    }
  );

  const { error } = await supabase
    .from("debug_feedback")
    .insert([{ is_helpful: isHelpful, debug_id: debugId || "anonymous_scan" }]);

  if (error) {
    console.error("Feedback submission failed:", error.message);
    return { success: false };
  }

  return { success: true };
}