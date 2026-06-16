// app/api/limits/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ratelimitFree, ratelimitAuth } from "@/lib/ratelimit";
import { getUsageCount } from "@/lib/usage";
import { isAdmin } from "@/lib/usage";
import {
  FREE_DAILY_LIMIT,
  PRO_DAILY_LIMIT,
} from "@/lib/constants";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const userId   = user?.id;
    const userEmail = user?.email;

    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    if (!userId) {
      const limitState = await ratelimitFree.getRemaining(ip);
      const remaining  = limitState ? limitState.remaining : FREE_DAILY_LIMIT;
      return NextResponse.json({ remaining, maxTokens: FREE_DAILY_LIMIT });
    }

    if (isAdmin(userEmail)) {
      return NextResponse.json({ remaining: PRO_DAILY_LIMIT, maxTokens: PRO_DAILY_LIMIT });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier")
      .eq("id", userId)
      .single();

    const isPro     = profile?.plan_tier === "pro";
    const maxTokens = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;

    const limitState  = await ratelimitAuth.getRemaining(userId);
    const rlRemaining = limitState ? limitState.remaining : maxTokens;

    const dbUsage     = await getUsageCount(supabase, userId);
    const dbRemaining = Math.max(0, maxTokens - dbUsage);

    const remaining = Math.min(rlRemaining, dbRemaining);

    return NextResponse.json({ remaining, maxTokens });
  } catch {
    return NextResponse.json({ remaining: FREE_DAILY_LIMIT, maxTokens: FREE_DAILY_LIMIT }, { status: 500 });
  }
}