/**
 * app/api/keys/route.ts
 *
 * GET  /api/keys  → List the current user's active API keys (never exposes hashes)
 * POST /api/keys  → Create a new API key (raw key returned exactly once)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { generateApiKey } from "@/lib/api-keys";

const MAX_KEYS_PER_USER = 5;
const MAX_LABEL_LENGTH  = 100;

// Postgres error codes we handle explicitly
const PG_CHECK_VIOLATION  = "23514"; // e.g. a DB-level max-keys constraint
const PG_UNIQUE_VIOLATION = "23505"; // hash collision (astronomically rare, but handle it)

// ── GET — list active keys ────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, label, created_at, last_used_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[keys:GET] Query failed:", error);
    return NextResponse.json({ error: "Failed to fetch keys." }, { status: 500 });
  }

  return NextResponse.json({ keys });
}

// ── POST — create a new key ───────────────────────────────────────────────────
export async function POST(req: Request) {
  // ── 1. Auth ─────────────────────────────────────────────────────────────
  const supabase = await createClient();

  // Destructure safely — don't assume `data` is always defined.
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Parse and validate label ──────────────────────────────────────────
  let label = "My API Key";
  try {
    const body = await req.json();

    if (body.label !== undefined) {
      // `??` only catches null/undefined — `||` is correct here so that
      // an empty string "" doesn't slip through as a valid label.
      if (typeof body.label !== "string") {
        return NextResponse.json(
          { error: "label must be a string." },
          { status: 400 },
        );
      }

      const trimmed = body.label.trim();

      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: "label must not be empty." },
          { status: 400 },
        );
      }

      if (trimmed.length > MAX_LABEL_LENGTH) {
        return NextResponse.json(
          { error: `label must be ${MAX_LABEL_LENGTH} characters or fewer.` },
          { status: 400 },
        );
      }

      label = trimmed;
    }
  } catch {
    // Body is entirely optional — proceed with the default label.
  }

  // ── 3. Count active keys (fast early-exit for the normal case) ───────────
  //
  // This check is NOT atomic with the insert below. Two simultaneous requests
  // can both pass here and both insert, exceeding the limit.
  //
  // The database-level backstop that makes this bulletproof:
  //
  //   CREATE OR REPLACE FUNCTION check_api_key_limit()
  //   RETURNS TRIGGER AS $$
  //   BEGIN
  //     IF (SELECT COUNT(*) FROM api_keys
  //         WHERE user_id = NEW.user_id AND revoked_at IS NULL) >= 5 THEN
  //       RAISE EXCEPTION 'API key limit reached' USING ERRCODE = '23514';
  //     END IF;
  //     RETURN NEW;
  //   END;
  //   $$ LANGUAGE plpgsql;
  //
  //   CREATE TRIGGER enforce_api_key_limit
  //   BEFORE INSERT ON api_keys
  //   FOR EACH ROW EXECUTE FUNCTION check_api_key_limit();
  //
  // The application catches PG error 23514 below so the race results in a
  // clean 403 rather than a silent over-insertion.

  const { count, error: countError } = await supabase
    .from("api_keys")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (countError) {
    console.error("[keys:POST] Count query failed:", countError);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  if (count !== null && count >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      {
        error:   "Key limit reached.",
        message: `You can have at most ${MAX_KEYS_PER_USER} active API keys. Revoke one to create a new one.`,
      },
      { status: 403 },
    );
  }

  // ── 4. Generate key material ─────────────────────────────────────────────
  let raw: string, hash: string;
  try {
    ({ raw, hash } = generateApiKey());
  } catch (err) {
    console.error("[keys:POST] Key generation failed:", err);
    return NextResponse.json({ error: "Failed to generate key." }, { status: 500 });
  }

  // ── 5. Insert — with explicit metadata return ────────────────────────────
  const { data: newKey, error: insertError } = await supabase
    .from("api_keys")
    .insert({ user_id: user.id, key_hash: hash, label })
    .select("id, label, created_at")
    .single();

  if (insertError) {
    // Race condition: another request won the insert between our count check
    // and here. The DB trigger fires and raises a check violation.
    if (insertError.code === PG_CHECK_VIOLATION) {
      return NextResponse.json(
        {
          error:   "Key limit reached.",
          message: `You can have at most ${MAX_KEYS_PER_USER} active API keys. Revoke one to create a new one.`,
        },
        { status: 403 },
      );
    }

    // Hash collision — vanishingly rare with a proper crypto implementation,
    // but if it happens don't expose internal details to the caller.
    if (insertError.code === PG_UNIQUE_VIOLATION) {
      console.error("[keys:POST] Hash collision on insert — investigate generateApiKey()");
      return NextResponse.json({ error: "Failed to create key. Please try again." }, { status: 500 });
    }

    console.error("[keys:POST] Insert error:", insertError);
    return NextResponse.json({ error: "Failed to create key." }, { status: 500 });
  }

  // ── 6. Return raw key exactly once ───────────────────────────────────────
  // `raw` is never written to the database — this response is the only time
  // it will ever be visible. The caller must store it immediately.
  return NextResponse.json(
    {
      key:       raw,
      id:        newKey.id,
      label:     newKey.label,
      createdAt: newKey.created_at,
      warning:   "Store this key now — it cannot be shown again.",
    },
    { status: 201 },
  );
}