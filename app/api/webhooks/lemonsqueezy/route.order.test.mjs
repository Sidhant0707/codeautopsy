// Run with: node --test app/api/webhooks/lemonsqueezy/route.order.test.mjs  (Node 22.18+ / 24)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { registerHooks } from 'node:module'
import { makeDb } from './_fakedb.mjs'

const stubs = {
  'next/server': 'export class NextRequest {}; export const NextResponse = { json: (body, init) => ({ status: init?.status ?? 200, body }) }',
  '@supabase/supabase-js': 'export const createClient = () => globalThis.__db',
}
registerHooks({
  resolve(spec, ctx, next) {
    return stubs[spec] ? { url: 'stub:' + spec, shortCircuit: true } : next(spec, ctx)
  },
  load(url, ctx, next) {
    return url.startsWith('stub:')
      ? { format: 'module', source: stubs[url.slice(5)], shortCircuit: true }
      : next(url, ctx)
  },
})

process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 'test-secret'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
process.env.SUPABASE_SERVICE_KEY = 'key'
const { POST } = await import('./route.ts')

let profiles
beforeEach(() => {
  profiles = [{ id: 'u1', plan_tier: 'free', subscription_status: null, subscription_event_at: null }]
  globalThis.__db = makeDb({ profiles })
})

function send(eventName, status, updatedAt) {
  const raw = JSON.stringify({
    meta: { event_name: eventName, custom_data: { supabase_user_id: 'u1' } },
    data: { attributes: { status, updated_at: updatedAt } },
  })
  const signature = crypto.createHmac('sha256', 'test-secret').update(raw).digest('hex')
  return POST({ text: async () => raw, headers: { get: (h) => (h === 'x-signature' ? signature : null) } })
}

test('a delayed older update does not undo a newer cancellation', async () => {
  await send('subscription_cancelled', 'cancelled', '2025-10-20T10:00:02Z')
  await send('subscription_updated', 'active', '2025-10-20T10:00:01Z') // arrives late
  assert.equal(profiles[0].subscription_status, 'cancelled')
  assert.equal(profiles[0].plan_tier, 'free')
})

test('events delivered in order are still applied', async () => {
  await send('subscription_created', 'active', '2025-10-20T10:00:01Z')
  assert.equal(profiles[0].plan_tier, 'pro')
  await send('subscription_cancelled', 'cancelled', '2025-10-20T10:00:02Z')
  assert.equal(profiles[0].plan_tier, 'free')
})
