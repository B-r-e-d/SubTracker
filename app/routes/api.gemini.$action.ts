import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'

/**
 * Simple optional in-memory per-IP rate limiter (recommended but optional)
 */
const WINDOW_MS = 60_000
const LIMIT = 60 // 60 requests/min/IP
const buckets = new Map<string, { count: number; resetAt: number }>()

function ipFromRequest(request: Request): string {
  const h = request.headers
  const xff = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = h.get('x-real-ip')?.trim()
  const cf = h.get('cf-connecting-ip')?.trim()
  return xff || realIp || cf || 'unknown'
}

function rateLimit(request: Request): { ok: true } | { ok: false; retryAfter: number } {
  const ip = ipFromRequest(request)
  const now = Date.now()
  const entry = buckets.get(ip)
  if (!entry || now >= entry.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true }
  }
  if (entry.count >= LIMIT) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count += 1
  return { ok: true }
}

/**
 * Response helpers
 */
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, max-age=0',
}

function badRequest(message: string) {
  return json({ error: { code: 'BAD_REQUEST', message } }, { status: 400, headers: JSON_HEADERS })
}
function unauthorized(message: string) {
  return json({ error: { code: 'UNAUTHORIZED', message } }, { status: 401, headers: JSON_HEADERS })
}
function rateLimited(retryAfter?: number) {
  const headers = { ...JSON_HEADERS } as Record<string, string>
  if (retryAfter) headers['Retry-After'] = String(retryAfter)
  return json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { status: 429, headers })
}
function modelError(message: string) {
  return json({ error: { code: 'MODEL_ERROR', message } }, { status: 500, headers: JSON_HEADERS })
}
function timeoutError(message: string) {
  return json({ error: { code: 'TIMEOUT', message } }, { status: 504, headers: JSON_HEADERS })
}

type ChatRole = 'user' | 'assistant' | 'system'
type ChatMessage = { role: ChatRole; content: string }
type ChatBody = { messages: ChatMessage[]; context?: { timezone?: string; currency?: string; locale?: string } }

type SubscriptionItem = {
  id: string
  name: string
  category: string
  amount: number
  currency: string
  billingCycle: string
  nextPaymentDate: string
  isActive: boolean
}
type Preferences = {
  defaultCurrency?: string
  savingsGoal?: number
  locale?: string
  timezone?: string
}
type SuggestionsBody = {
  subscriptions: SubscriptionItem[]
  preferences?: Preferences
}

const MAX_CHAT_MESSAGES = 50
const MAX_SUBSCRIPTIONS = 200

function isValidRole(role: unknown): role is ChatRole {
  return role === 'user' || role === 'assistant' || role === 'system'
}

function sanitizeMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input)) return null
  const capped = input.slice(-MAX_CHAT_MESSAGES)
  const out: ChatMessage[] = []
  for (const m of capped) {
    if (!m || typeof m !== 'object') continue
    const role = (m as Record<string, unknown>).role
    const content = (m as Record<string, unknown>).content
    if (!isValidRole(role)) continue
    if (typeof content !== 'string') continue
    const trimmed = content.trim()
    if (!trimmed) continue
    out.push({ role, content: trimmed })
  }
  return out.length > 0 ? out : null
}

function sanitizeContext(input: unknown): ChatBody['context'] | undefined {
  if (!input || typeof input !== 'object') return undefined
  const ctx = input as Record<string, unknown>
  const out: ChatBody['context'] = {}
  if (typeof ctx.timezone === 'string' && ctx.timezone.trim()) out.timezone = ctx.timezone.trim()
  if (typeof ctx.currency === 'string' && ctx.currency.trim()) out.currency = ctx.currency.trim()
  if (typeof ctx.locale === 'string' && ctx.locale.trim()) out.locale = ctx.locale.trim()
  return Object.keys(out).length ? out : undefined
}

function sanitizeSubscriptions(input: unknown): SubscriptionItem[] | null {
  if (!Array.isArray(input)) return null
  const capped = input.slice(0, MAX_SUBSCRIPTIONS)
  const out: SubscriptionItem[] = []
  for (const it of capped) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : null
    const name = typeof o.name === 'string' ? o.name : null
    const category = typeof o.category === 'string' ? o.category : null
    const amount = typeof o.amount === 'number' && Number.isFinite(o.amount) ? (o.amount as number) : null
    const currency = typeof o.currency === 'string' ? o.currency : null
    const billingCycle = typeof o.billingCycle === 'string' ? o.billingCycle : null
    const nextPaymentDate = typeof o.nextPaymentDate === 'string' ? o.nextPaymentDate : null
    const isActive = typeof o.isActive === 'boolean' ? o.isActive : null
    if (
      !id ||
      !name ||
      !category ||
      amount === null ||
      !currency ||
      !billingCycle ||
      !nextPaymentDate ||
      isActive === null
    ) {
      continue
    }
    out.push({
      id,
      name,
      category,
      amount,
      currency,
      billingCycle,
      nextPaymentDate,
      isActive,
    })
  }
  return out.length > 0 ? out : null
}

function sanitizePreferences(input: unknown): Preferences | undefined {
  if (!input || typeof input !== 'object') return undefined
  const o = input as Record<string, unknown>
  const out: Preferences = {}
  if (typeof o.defaultCurrency === 'string' && o.defaultCurrency.trim()) out.defaultCurrency = o.defaultCurrency.trim()
  if (typeof o.savingsGoal === 'number' && Number.isFinite(o.savingsGoal)) out.savingsGoal = o.savingsGoal
  if (typeof o.locale === 'string' && o.locale.trim()) out.locale = o.locale.trim()
  if (typeof o.timezone === 'string' && o.timezone.trim()) out.timezone = o.timezone.trim()
  return Object.keys(out).length ? out : undefined
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json(
      { error: { code: 'BAD_REQUEST', message: 'Only POST is allowed' } },
      { status: 400, headers: JSON_HEADERS },
    )
  }

  // Optional rate limiting
  const rl = rateLimit(request)
  if (!rl.ok) return rateLimited(rl.retryAfter)

  const action = params.action
  if (action !== 'chat' && action !== 'suggestions') {
    return badRequest('Unknown action')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  // Dynamically import the service to allow graceful 401 mapping when key missing
  let gemini: typeof import('~/services/gemini.server')
  try {
    gemini = await import('~/services/gemini.server')
  } catch (e: unknown) {
    // Service module throws if the key is missing on import
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('GEMINI_API_KEY is not set')) {
      return unauthorized('Server configuration missing: GEMINI_API_KEY')
    }
    return modelError(e instanceof Error ? e.message : 'Failed to initialize Gemini service')
  }

  if (action === 'chat') {
    const bodyObj = body as Record<string, unknown>
    const messages = sanitizeMessages(bodyObj?.messages)
    const context = sanitizeContext(bodyObj?.context)
    if (!messages) return badRequest('messages must be a non-empty array of valid items (max 50)')
    try {
      const result = await gemini.geminiChat(messages, context)
      return json(
        {
          message: {
            role: 'assistant',
            content: result.message.content,
            ...(result.message.annotations ? { annotations: result.message.annotations } : {}),
          },
          ...(result.usage ? { usage: result.usage } : {}),
        },
        { headers: JSON_HEADERS },
      )
    } catch (e: unknown) {
      const error = e as { code?: string; message?: string }
      if (error?.code === 'BAD_REQUEST') return badRequest(error.message || 'Invalid chat request')
      if (error?.code === 'TIMEOUT') return timeoutError('The chat operation timed out')
      return modelError(error?.message || 'Chat model error')
    }
  }

  // suggestions
  const bodyObj = body as Record<string, unknown>
  const subs = sanitizeSubscriptions(bodyObj?.subscriptions)
  const prefs = sanitizePreferences(bodyObj?.preferences)
  if (!subs) return badRequest('subscriptions must be a non-empty array of valid items (max 200)')

  const sampledAt = new Date().toISOString()
  try {
    const result = await gemini.geminiSuggestions(subs, prefs, sampledAt)
    return json(
      {
        suggestions: result.suggestions,
        ...(result.summary ? { summary: result.summary } : {}),
        ...(result.usage ? { usage: result.usage } : {}),
      },
      { headers: JSON_HEADERS },
    )
  } catch (e: unknown) {
    const error = e as { code?: string; message?: string }
    if (error?.code === 'BAD_REQUEST') return badRequest(error.message || 'Invalid suggestions request')
    if (error?.code === 'TIMEOUT') return timeoutError('The suggestions operation timed out')
    return modelError(error?.message || 'Suggestions model error')
  }
}
