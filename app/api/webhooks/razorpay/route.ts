// src/app/api/webhooks/razorpay/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { z } from "zod"; // requires `npm install zod`

// ── Validate env vars at module load (fail early) ─────────────────────────
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!RAZORPAY_WEBHOOK_SECRET) {
  throw new Error("❌ Missing RAZORPAY_WEBHOOK_SECRET");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("❌ Missing Supabase environment variables");
}

// ── Supabase client (reused across invocations, no browser auth) ──────────
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// ── Constant‑time signature verification ──────────────────────────────────
function verifySignature(payload: string, signature: string): boolean {
  // RAZORPAY_WEBHOOK_SECRET is guaranteed to be a string because we throw earlier
  const secret: string = RAZORPAY_WEBHOOK_SECRET!;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const computed = Buffer.from(hmac.digest("hex"), "utf-8");
  const provided = Buffer.from(signature, "utf-8");
  if (computed.length !== provided.length) return false;
  return crypto.timingSafeEqual(computed, provided);
}

// ── Zod schemas for Razorpay webhook payload ──────────────────────────────
const SubscriptionNotesSchema = z.object({
  supabase_user_id: z.string().uuid(),
});

const SubscriptionEntitySchema = z.object({
  id: z.string(),
  status: z.string(),
  notes: z.record(z.string(), z.string()).optional(),
});

const WebhookPayloadSchema = z.object({
  id: z.string(),
  event: z.string(),
  payload: z.object({
    subscription: z.object({
      entity: SubscriptionEntitySchema,
    }),
  }),
});

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// ── Profiles update payload builder ────────────────────────────────────────
type PlanTier = "free" | "pro";

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["active"]);
const INACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "halted",
  "cancelled",
  "expired",
  "completed",
]);

function getProfileUpdate(
  eventName: string,
  subscription: { id: string; status: string }
): { plan_tier: PlanTier; subscription_status: string; razorpay_subscription_id?: string } | null {
  switch (eventName) {
    case "subscription.activated":
      return {
        plan_tier: "pro",
        subscription_status: "active",
        razorpay_subscription_id: subscription.id,
      };

    case "subscription.updated": {
      const status = subscription.status;
      if (ACTIVE_STATUSES.has(status)) {
        return { plan_tier: "pro", subscription_status: "active" };
      }
      if (INACTIVE_STATUSES.has(status)) {
        return { plan_tier: "free", subscription_status: status };
      }
      console.warn(`Ignoring unexpected subscription status: "${status}"`);
      return null;
    }

    case "subscription.cancelled":
      return { plan_tier: "free", subscription_status: "cancelled" };
    case "subscription.halted":
      return { plan_tier: "free", subscription_status: "halted" };
    case "subscription.completed":
      return { plan_tier: "free", subscription_status: "completed" };

    default:
      return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Capture raw body & signature
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  // 2. Verify signature (constant‑time)
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parse JSON strictly
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 4. Validate webhook payload shape
  const result = WebhookPayloadSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Webhook payload validation failed:", result.error.flatten());
    return NextResponse.json({ error: "Invalid payload structure" }, { status: 400 });
  }

  const event: WebhookPayload = result.data;

  // 5. Idempotency check – avoid processing the same event twice
  const { data: existing } = await supabase
    .from("razorpay_event_log")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  // 6. Extract subscription entity & user ID from notes
  const subscription = event.payload.subscription.entity;
  const notes = subscription.notes;

  if (!notes) {
    return NextResponse.json({ error: "No notes in subscription" }, { status: 400 });
  }

  const notesParseResult = SubscriptionNotesSchema.safeParse(notes);
  if (!notesParseResult.success) {
    console.error("Invalid notes format:", notesParseResult.error.flatten());
    return NextResponse.json({ error: "Invalid subscription notes" }, { status: 400 });
  }

  const userId = notesParseResult.data.supabase_user_id;

  // 7. Determine what to update in profiles
  const updatePayload = getProfileUpdate(event.event, subscription);
  if (!updatePayload) {
    console.warn(`Skipping unhandled event "${event.event}" (id=${event.id})`);
    return NextResponse.json({ received: true });
  }

  // 8. Update the user's profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update profile:", updateError.message, updateError.details);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  // 9. Record processed event (idempotency gate)
  const insertTimestamp = new Date().toISOString();
  const { error: logError } = await supabase.from("razorpay_event_log").insert({
    event_id: event.id,
    event_type: event.event,
    processed_at: insertTimestamp,
  });

  if (logError) {
    // Non‑fatal: the profile update already succeeded, but log the failure.
    console.error("Failed to log event idempotency key:", logError.message);
  }

  // 10. Success – tell Razorpay we're done
  return NextResponse.json({ received: true });
}