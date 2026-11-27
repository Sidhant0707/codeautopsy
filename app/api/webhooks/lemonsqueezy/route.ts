import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function verifySignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET!)
  const digest = hmac.update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
}

export async function POST(req: NextRequest) {
  // ← moved inside the function, not at module level
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const rawBody = await req.text()
  const signature = req.headers.get('x-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const eventName = event.meta.event_name
  const userId = event.meta.custom_data?.supabase_user_id
  const status = event.data.attributes.status
  // Lemon Squeezy does not guarantee delivery order: only apply an event newer than the last one applied.
  const eventAt = new Date(event.data.attributes.updated_at ?? Date.now()).toISOString()
  const notStale = `subscription_event_at.is.null,subscription_event_at.lt.${eventAt}`

  if (!userId) return NextResponse.json({ error: 'No user ID' }, { status: 400 })

  if (eventName === 'subscription_created') {
    await supabase.from('profiles').update({
      plan_tier: 'pro',
      subscription_status: 'active',
      subscription_event_at: eventAt,
    }).eq('id', userId).or(notStale)
  }

  if (eventName === 'subscription_updated') {
    await supabase.from('profiles').update({
      plan_tier: status === 'active' ? 'pro' : 'free',
      subscription_status: status,
      subscription_event_at: eventAt,
    }).eq('id', userId).or(notStale)
  }

  if (eventName === 'subscription_cancelled') {
    await supabase.from('profiles').update({
      plan_tier: 'free',
      subscription_status: 'cancelled',
      subscription_event_at: eventAt,
    }).eq('id', userId).or(notStale)
  }

  return NextResponse.json({ received: true })
}