// src/app/api/checkout/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function POST() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')

  const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      notes: {
        supabase_user_id: user.id,
        email: user.email,
      },
    }),
  })

  const data = await response.json()

  if (!data.id) {
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }

  return NextResponse.json({
    subscription_id: data.id,
    key: process.env.RAZORPAY_KEY_ID,
    email: user.email,
    name: user.user_metadata?.full_name ?? '',
  })
}