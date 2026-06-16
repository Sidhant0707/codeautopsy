// src/app/api/checkout/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Environment — validated at cold start; missing vars crash immediately
// ---------------------------------------------------------------------------
const ENV = {
  RAZORPAY_KEY_ID:     process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET!,
  RAZORPAY_PLAN_ID:    process.env.RAZORPAY_PLAN_ID!,
  SUPABASE_URL:        process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY:   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
} as const

const MISSING_VARS = Object.entries(ENV)
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (MISSING_VARS.length > 0) {
  throw new Error(`Missing environment variables: ${MISSING_VARS.join(', ')}`)
}

const RAZORPAY_CREDENTIALS = Buffer.from(
  `${ENV.RAZORPAY_KEY_ID}:${ENV.RAZORPAY_KEY_SECRET}`
).toString('base64')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// 10-year ceiling — Razorpay requires a total_count cap.
// Actual lifecycle (pause, cancel) is managed via webhooks + dashboard.
const SUBSCRIPTION_TOTAL_COUNT = 120

// Abort Razorpay API calls after this — prevents serverless function from hanging
const RAZORPAY_TIMEOUT_MS = 10_000

// A subscription stuck in 'created' beyond this is considered abandoned.
// Razorpay also auto-expires unauthenticated subscriptions, so this mirrors that.
const STALE_CREATED_THRESHOLD_MS = 24 * 60 * 60 * 1000

// All statuses where a live Razorpay mandate exists for the user.
// 'halted'    = payment retry limit hit, but mandate still active
// 'pending'   = UPI/NACH mandate accepted, first charge not yet collected
// 'created'   = awaiting authentication (excluded if stale — see above)
const LIVE_STATUSES = ['created', 'authenticated', 'active', 'pending', 'halted'] as const
type LiveStatus = (typeof LIVE_STATUSES)[number]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RazorpaySubscription {
  id: string
  status: string
  plan_id: string
}

interface RazorpayError {
  error?: {
    code?: string
    description?: string
    source?: string
    step?: string
    reason?: string
  }
}

interface SubscriptionRow {
  razorpay_subscription_id: string
  status: LiveStatus
  created_at: string
}

// ---------------------------------------------------------------------------
// Structured logger — consistent format for searchability in Vercel/Datadog/etc.
// ---------------------------------------------------------------------------
const log = {
  error: (event: string, meta: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'error', route: 'POST /api/subscription', event, ...meta })),
  warn: (event: string, meta: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'warn', route: 'POST /api/subscription', event, ...meta })),
}

// ---------------------------------------------------------------------------
// Supabase server client
// ---------------------------------------------------------------------------
function buildSupabaseClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — cookie writes are no-ops, safe to ignore
        }
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Razorpay helpers
// ---------------------------------------------------------------------------

// Deterministic per-user-per-plan key, hashed to a fixed 36-char hex string.
// Ensures concurrent requests to Razorpay produce the same subscription ID.
function buildIdempotencyKey(userId: string, planId: string): string {
  return createHash('sha256')
    .update(`${userId}:${planId}`)
    .digest('hex')
    .slice(0, 36)
}

async function createRazorpaySubscription(
  userId: string,
  email: string
): Promise<RazorpaySubscription> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RAZORPAY_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization:                `Basic ${RAZORPAY_CREDENTIALS}`,
        'Content-Type':               'application/json',
        'X-Razorpay-Idempotency-Key': buildIdempotencyKey(userId, ENV.RAZORPAY_PLAN_ID),
      },
      body: JSON.stringify({
        plan_id:         ENV.RAZORPAY_PLAN_ID,
        total_count:     SUBSCRIPTION_TOTAL_COUNT,
        quantity:        1,
        customer_notify: 1,
        notes: {
          supabase_user_id: userId,
          email,
        },
      }),
    })
  } catch (err) {
    const isTimeout = (err as Error).name === 'AbortError'
    throw new Error(
      isTimeout
        ? `Razorpay API timed out after ${RAZORPAY_TIMEOUT_MS / 1000}s`
        : `Razorpay network error: ${(err as Error).message}`
    )
  } finally {
    clearTimeout(timeout)
  }

  const body: RazorpaySubscription | RazorpayError = await response.json()

  if (!response.ok) {
    const errBody = body as RazorpayError
    throw new Error(
      errBody.error?.description ?? `Razorpay returned HTTP ${response.status}`
    )
  }

  const sub = body as RazorpaySubscription
  if (!sub.id) {
    throw new Error('Razorpay returned 2xx but no subscription ID — unexpected shape')
  }

  return sub
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase    = buildSupabaseClient(cookieStore)

    // 1. Auth — always verify server-side; never trust client-supplied user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Email guard — Supabase supports phone-only accounts; Razorpay requires email
    if (!user.email) {
      return NextResponse.json(
        { error: 'An email address is required to subscribe' },
        { status: 400 }
      )
    }

    // 3. Idempotency check — look for any live subscription for this user
    const { data: existing, error: dbReadError } = await supabase
      .from('subscriptions')
      .select('razorpay_subscription_id, status, created_at')
      .eq('user_id', user.id)
      .in('status', LIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (dbReadError) {
      log.error('db_read_failed', { userId: user.id, error: dbReadError })
      return NextResponse.json(
        { error: 'Failed to verify existing subscription' },
        { status: 500 }
      )
    }

    if (existing) {
      const row = existing as SubscriptionRow

      // 'created' subscriptions older than the threshold are abandoned —
      // allow a fresh one. All other live statuses block unconditionally.
      const isAbandoned =
        row.status === 'created' &&
        Date.now() - new Date(row.created_at).getTime() > STALE_CREATED_THRESHOLD_MS

      if (!isAbandoned) {
        return NextResponse.json({
          subscription_id: row.razorpay_subscription_id,
          key:   ENV.RAZORPAY_KEY_ID,
          email: user.email,
          name:  user.user_metadata?.full_name ?? '',
        })
      }

      log.warn('stale_created_subscription_bypassed', {
        userId:             user.id,
        subscriptionId:     row.razorpay_subscription_id,
        createdAt:          row.created_at,
      })
    }

    // 4. Create subscription on Razorpay
    const subscription = await createRazorpaySubscription(user.id, user.email)

    // 5. Persist before returning to client.
    //    If this write fails, the subscription exists on Razorpay but not locally —
    //    log the ID so it can be reconciled. Your DB should have:
    //      UNIQUE (user_id) WHERE status IN ('created','authenticated','active','pending','halted')
    const { error: dbWriteError } = await supabase
      .from('subscriptions')
      .insert({
        user_id:                    user.id,
        razorpay_subscription_id:   subscription.id,
        razorpay_plan_id:           ENV.RAZORPAY_PLAN_ID,
        status:                     'created',
        // created_at: intentionally omitted — let Postgres DEFAULT NOW() handle it
      })

    if (dbWriteError) {
      // Unique constraint violation (PG code 23505):
      // A concurrent request won the race and already inserted.
      // The Razorpay idempotency key guarantees both requests got the same
      // subscription ID, so it's safe to return whatever is in the DB.
      if (dbWriteError.code === '23505') {
        const { data: concurrent } = await supabase
          .from('subscriptions')
          .select('razorpay_subscription_id')
          .eq('user_id', user.id)
          .in('status', LIVE_STATUSES)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        return NextResponse.json({
          subscription_id: concurrent?.razorpay_subscription_id ?? subscription.id,
          key:   ENV.RAZORPAY_KEY_ID,
          email: user.email,
          name:  user.user_metadata?.full_name ?? '',
        })
      }

      // Any other DB error — orphaned Razorpay subscription needs manual reconciliation
      log.error('db_write_failed_orphaned_subscription', {
        userId:                   user.id,
        razorpay_subscription_id: subscription.id,
        error:                    dbWriteError,
      })
      return NextResponse.json(
        { error: 'Subscription created but could not be saved. Contact support.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscription_id: subscription.id,
      key:   ENV.RAZORPAY_KEY_ID,
      email: user.email,
      name:  user.user_metadata?.full_name ?? '',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    log.error('unhandled_exception', { message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}