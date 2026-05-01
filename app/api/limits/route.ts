import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ratelimitFree, ratelimitAuth } from "@/lib/ratelimit"; 

export async function GET(req: NextRequest) {
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
    const userId = user?.id;

    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    const identifier = userId ? userId : ip;
    const limiter = userId ? ratelimitAuth : ratelimitFree;
    const maxTokens = userId ? 50 : 3;

    const limitState = await limiter.getRemaining(identifier);

    const remaining = limitState ? limitState.remaining : maxTokens;

    return NextResponse.json({ remaining, maxTokens });
  } catch (err) {
    return NextResponse.json({ remaining: 3, maxTokens: 3 }, { status: 500 }); 
  }
}