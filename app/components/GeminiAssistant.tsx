import { useLocation, useNavigate } from '@remix-run/react'
import { motion } from 'framer-motion'
import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Button } from '~/components/ui/button'
import { Sheet, SheetContent } from '~/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Textarea } from '~/components/ui/textarea'

import { useToast } from '~/hooks/use-toast'
import { useTypewriterMarkdown } from '~/hooks/useTypewriterMarkdown'
import useSubscriptionStore from '~/store/subscriptionStore'
import { usePreferencesStore } from '~/stores/preferences'

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type SuggestionItem = {
  type: 'optimize' | 'cancel' | 'negotiate' | 'reminder' | 'consolidate' | 'misc'
  title: string
  description: string
  targetIds: string[]
  impactEstimate?: { monthlyDelta: number; currency: string }
  confidence: number
  actions: Array<{
    label: string
    intent: 'open' | 'copy' | 'navigate' | 'toggle' | 'none'
    payload?: Record<string, unknown>
  }>
}

type SuggestionsResponse = {
  suggestions: SuggestionItem[]
  summary?: string
  usage?: { inputTokens?: number; outputTokens?: number }
}

type MessageAnnotation = {
  citationSources?: Array<{
    startIndex?: number
    endIndex?: number
    uri?: string
    license?: string
  }>
  category?: string
  probability?: string
  blocked?: boolean
}

type ChatResponse = {
  message: { role: 'assistant'; content: string; annotations?: MessageAnnotation[] }
  usage?: { inputTokens?: number; outputTokens?: number }
}

const MAX_HISTORY = 50
const MAX_SUBS = 200

/**
 * Build a sanitized subscriptions snapshot for system context.
 * - Maps to { name, amount (2dp), currency }
 * - Trims name to 60 chars
 * - Caps at 50 entries; if more and currencies are mixed in the remainder, skip aggregation.
 *   Otherwise, aggregate the remainder into: { name: "Other (n)", amount: sum, currency: "[varies]" }.
 */
function buildSubscriptionsSnapshot(
  subs: Array<{ id: string; name: string; price: number; currency: string }>,
): Array<{ name: string; amount: number; currency: string }> {
  if (!Array.isArray(subs) || subs.length === 0) return []
  const trim = (s: string) => (typeof s === 'string' && s.length > 60 ? s.slice(0, 60) : String(s || ''))
  const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

  const first = subs.slice(0, 50).map((s) => ({
    name: trim(s.name),
    amount: round2(s.price),
    currency: String(s.currency || ''),
  }))

  if (subs.length <= 50) return first

  const remainder = subs.slice(50)
  const remainderCurrencies = new Set(remainder.map((s) => String(s.currency || '')))
  // If mixed currencies in remainder, skip aggregation
  if (remainderCurrencies.size > 1) return first

  const sum = round2(remainder.reduce((acc, s) => acc + (Number(s.price) || 0), 0))
  return [...first, { name: `Other (${remainder.length})`, amount: sum, currency: '[varies]' }]
}

const BASE_SYSTEM_PROMPT = [
  'You are the Subscriptions Dashboard AI assistant for a personal finance app.',
  'Purpose: help the user understand, manage, and optimize their subscriptions within this dashboard.',
  'Behavior:',
  '- Be concise and actionable. When appropriate, use Markdown formatting (bold, lists, tables, code blocks).',
  '- Never claim access to bank accounts, emails, or external services. You only see what the user shares.',
  '- When asked about subscriptions, use the ‘Subscriptions snapshot’ provided in the system context to answer directly. If the snapshot is absent, gracefully state that no subscription data is available.',
  '- Prefer short checklists and clear next steps. Avoid hallucinating subscription entries.',
  'Formatting:',
  '- Use **bold** for key figures, bullet lists for steps, and backticks for short inline terms.',
].join('\n')

function Spinner({ className = 'h-4 w-4 animate-spin text-muted-foreground' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <title>Loading</title>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function SparkleIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <title>AI Assistant</title>
      <path d="M12 2l1.8 4.6L18 8.4l-4.2 1.8L12 15l-1.8-4.8L6 8.4l4.2-1.8L12 2zM4 14l1.2 3 3 1.2-3 1.2L4 22l-1.2-2.8L0 18.2l2.8-1.2L4 14zm16-2l.9 2.2 2.1.9-2.1.9L20 19l-.9-2.2-2.1-.9 2.1-.9L20 12z" />
    </svg>
  )
}

// Local fallback synthesis for suggestions
function formatAmount(amount: number, currency?: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0)
  } catch {
    const a = Math.round((Number(amount) || 0) * 100) / 100
    return `${a} ${currency || 'USD'}`
  }
}

function synthesizeFallbackSuggestions(
  subsInput: Array<{ id: string; name: string; price: number; currency: string }>,
  limit = 3,
): SuggestionItem[] {
  const safeSubs = Array.isArray(subsInput) ? subsInput.slice() : []
  safeSubs.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
  const pick = safeSubs.slice(0, Math.max(0, Math.min(limit, 3)))

  const items: SuggestionItem[] = pick.map((s) => ({
    type: 'optimize',
    title: `Review ${s.name}`,
    description: `Consider optimizing ${s.name} which costs ${formatAmount(s.price, s.currency)}/mo.`,
    targetIds: [String(s.id)],
    confidence: 0.7,
    actions: [],
  }))

  const generics: Array<Pick<SuggestionItem, 'type' | 'title' | 'description'>> = [
    {
      type: 'reminder',
      title: 'Track upcoming renewals',
      description: 'Review renewal dates and cancel or renegotiate before auto-renewals.',
    },
    {
      type: 'consolidate',
      title: 'Consolidate overlapping tools',
      description: 'Identify subscriptions with similar features and consolidate to a single plan.',
    },
    {
      type: 'optimize',
      title: 'Check for student/annual discounts',
      description: 'Verify if student, annual, or bundle discounts are available to reduce monthly spend.',
    },
  ]

  let idx = 0
  while (items.length < 3) {
    const g = generics[idx % generics.length]
    items.push({
      type: g.type as SuggestionItem['type'],
      title: g.title,
      description: g.description,
      targetIds: [],
      confidence: 0.6,
      actions: [],
    })
    idx++
  }

  return items.slice(0, 3)
}

function buildPromptFromSuggestion(
  sug: SuggestionItem,
  subsInput: Array<{ id: string; name: string; price: number; currency: string }>,
): string {
  const idSet = new Set((sug.targetIds || []).map(String))
  const targetedNames = (Array.isArray(subsInput) ? subsInput : [])
    .filter((s) => idSet.has(String(s.id)))
    .map((s) => s.name)
  const meta = targetedNames.length ? ` Targeted: ${targetedNames.join(', ')}` : ''
  return `Analyze: ${sug.title}. ${sug.description}${meta}`
}

// Component for rendering assistant messages with typewriter animation
function AssistantMessage({ content, isLatest }: { content: string; isLatest: boolean }) {
  const { renderedMarkdown, isDone } = useTypewriterMarkdown({
    fullText: content,
    speedMs: 20,
    disabled: !isLatest,
  })

  return (
    <div className="text-output text-sm sm:text-base leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
        }}
      >
        {renderedMarkdown}
      </ReactMarkdown>
      {!isDone && isLatest && (
        <span className="inline-block ml-1 w-2 h-4 bg-foreground animate-typing-caret" aria-hidden="true">
          ▍
        </span>
      )}
    </div>
  )
}

export default function GeminiAssistant() {
  const navigate = useNavigate()
  const location = useLocation()
  const onDashboard = location.pathname.startsWith('/dashboard')
  const { toast } = useToast()

  const [open, setOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'chat'>('chat')

  const fabRef = React.useRef<HTMLButtonElement | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)

  // Chat state
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [inputText, setInputText] = React.useState('')
  const [isSending, setIsSending] = React.useState(false)
  const [sendPhase, setSendPhase] = React.useState<'idle' | 'ack' | 'thinking'>('idle')

  // Suggestions state
  const [suggestions, setSuggestions] = React.useState<SuggestionItem[]>([])
  const [summary, setSummary] = React.useState<string | undefined>(undefined)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false)

  // Stores
  const subs = useSubscriptionStore((s) => s.subscriptions)
  const selectedCurrency = usePreferencesStore((s) => s.selectedCurrency)

  const locale = React.useMemo(() => {
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
    return 'en-US'
  }, [])
  const timezone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return undefined
    }
  }, [])

  // Focus: autofocus textarea when chat tab becomes active or sheet opens on chat
  React.useEffect(() => {
    if (open && activeTab === 'chat') {
      const id = setTimeout(() => textareaRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [open, activeTab])

  // Scroll chat to bottom on new messages
  React.useEffect(() => {
    const el = listRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // Ensure scroll when opening sheet or switching back to Chat tab
  React.useEffect(() => {
    if (open && activeTab === 'chat') {
      const id = setTimeout(() => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, 0)
      return () => clearTimeout(id)
    }
  }, [open, activeTab])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // return focus to FAB for accessibility
      setTimeout(() => fabRef.current?.focus(), 0)
    }
  }

  const handleKeyDownTextarea: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  async function handleSend(promptOverride?: string) {
    if (isSending || sendPhase !== 'idle') return
    const source = typeof promptOverride === 'string' ? promptOverride : inputText
    const trimmed = source.trim()
    if (!trimmed) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg].slice(-MAX_HISTORY)

    setMessages(nextMessages)
    setInputText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setIsSending(true)
    setSendPhase('ack')

    // Brief acknowledgement phase
    await new Promise((resolve) => setTimeout(resolve, 300))
    setSendPhase('thinking')

    const context = {
      timezone,
      currency: selectedCurrency || undefined,
      locale,
    }

    // Compose a system instruction so the model behaves like a dashboard assistant and uses Markdown
    interface StoreWithGetState {
      getState?: () => { subscriptions: Array<{ id: string; name: string; price: number; currency: string }> }
    }
    const subsStatic = (
      typeof (useSubscriptionStore as StoreWithGetState)?.getState === 'function'
        ? (useSubscriptionStore as StoreWithGetState).getState?.().subscriptions
        : subs
    ) as Array<{ id: string; name: string; price: number; currency: string }>

    const snapshot = buildSubscriptionsSnapshot(Array.isArray(subsStatic) ? subsStatic : [])
    const instrParts: string[] = [
      BASE_SYSTEM_PROMPT,
      '',
      `User context: locale=${locale || 'en-US'}, timezone=${timezone || 'unknown'}, defaultCurrency=${selectedCurrency || 'USD'}.`,
      `Subscriptions known in client state: ~${Array.isArray(subsStatic) ? subsStatic.length : 0}.`,
    ]

    if (snapshot.length > 0) {
      instrParts.push(`Subscriptions snapshot (first ${snapshot.length}):`, '```json', JSON.stringify(snapshot), '```')
    }

    instrParts.push(
      'Always format responses using Markdown (GFM). Use bold for key numbers and bullet lists for steps.',
    )

    const systemInstruction = instrParts.join('\n')

    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.debug(
        '[Assistant] snapshot.length=',
        snapshot.length,
        'systemInstruction.length=',
        systemInstruction.length,
      )
    }

    const wireMessages = [
      { role: 'system', content: systemInstruction },
      ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
    ] as ChatMessage[]

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: wireMessages,
          context,
        }),
      })

      if (!res.ok) {
        const err = await safeJson(res)
        const msg =
          (err &&
            ((err as { error?: { message?: string }; message?: string }).error?.message ||
              (err as { message?: string }).message)) ||
          `Request failed with ${res.status}`
        throw new Error(msg)
      }

      const data: ChatResponse = await res.json()
      if (data?.message?.role === 'assistant') {
        setMessages((prev) => [...prev, data.message as ChatMessage].slice(-MAX_HISTORY))
      } else {
        // graceful fallback
        setMessages((prev) =>
          [...prev, { role: 'assistant', content: "I couldn't parse a response." } as ChatMessage].slice(-MAX_HISTORY),
        )
      }
    } catch (error: unknown) {
      toast({
        title: 'Chat error',
        description: String((error as Error)?.message || 'Something went wrong'),
        variant: 'destructive',
      })
      // Optional assistant-like error message
      setMessages((prev) =>
        [
          ...prev,
          { role: 'assistant', content: 'Sorry, I ran into an error handling that request.' } as ChatMessage,
        ].slice(-MAX_HISTORY),
      )
    } finally {
      setIsSending(false)
      setSendPhase('idle')
    }
  }

  const generateSuggestions = React.useCallback(async () => {
    if (isLoadingSuggestions) return

    // Optimistic: show 3 local fallback cards immediately
    setIsLoadingSuggestions(true)

    // Guard optimistic synthesis with try/catch and use a safe array
    try {
      const subsArr = Array.isArray(subs) ? subs : []
      const optimistic = synthesizeFallbackSuggestions(
        subsArr.map((s) => ({
          id: String(s.id),
          name: s.name,
          price: Number(s.price),
          currency: String(s.currency || ''),
        })),
        3,
      )
      setSuggestions(optimistic)
      setSummary(undefined)
    } catch {
      // Do not throw; write a generic fallback instead
      setSuggestions(synthesizeFallbackSuggestions([], 3))
      setSummary(undefined)
    }

    // Sanitize subscriptions to the whitelisted payload (truncate to MAX_SUBS)
    const sanitized = (Array.isArray(subs) ? subs : []).slice(0, MAX_SUBS).map((s) => ({
      id: String(s.id),
      name: s.name,
      // Store does not have these fields; provide safe defaults
      category: 'misc',
      amount: Number(s.price),
      currency: s.currency,
      billingCycle: 'monthly',
      nextPaymentDate: new Date().toISOString().slice(0, 10), // ISO date (YYYY-MM-DD)
      isActive: true,
    }))

    const preferences = {
      defaultCurrency: selectedCurrency || undefined,
      savingsGoal: undefined as number | undefined,
      locale,
      timezone,
    }

    const fallbackFromStore = () => {
      const subsArr = Array.isArray(subs) ? subs : []
      return synthesizeFallbackSuggestions(
        subsArr.map((s) => ({
          id: String(s.id),
          name: s.name,
          price: Number(s.price),
          currency: String(s.currency || ''),
        })),
        3,
      )
    }

    try {
      const res = await fetch('/api/gemini/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptions: sanitized,
          preferences,
        }),
      })

      if (!res.ok) {
        const err = await safeJson(res)
        const msg =
          (err &&
            ((err as { error?: { message?: string }; message?: string }).error?.message ||
              (err as { message?: string }).message)) ||
          `Request failed with ${res.status}`
        throw new Error(msg)
      }

      const data: SuggestionsResponse = await res.json()
      const apiSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : []

      if (apiSuggestions.length > 0) {
        // Replace optimistic fallback with real results
        setSuggestions(apiSuggestions)
        setSummary(data?.summary)
      } else {
        // Keep the optimistic fallback; just ensure summary is cleared
        setSummary(undefined)
      }
    } catch (error: unknown) {
      toast({
        title: 'Suggestion error',
        description: String((error as Error)?.message || 'Failed to generate suggestions'),
        variant: 'destructive',
      })
      // Keep the optimistic fallback already set
      setSummary(undefined)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [isLoadingSuggestions, subs, selectedCurrency, locale, timezone, toast])

  function runSuggestion(sug: SuggestionItem) {
    const prompt = buildPromptFromSuggestion(
      sug,
      subs.map((s) => ({
        id: String(s.id),
        name: s.name,
        price: Number(s.price),
        currency: String(s.currency || ''),
      })),
    )
    setActiveTab('chat')
    setInputText(prompt)
    void handleSend(prompt)
  }

  function handleSuggestionAction(item: SuggestionItem, action: SuggestionItem['actions'][number]) {
    const intent = action.intent
    const payload = action.payload || {}

    if (intent === 'navigate') {
      const to = typeof payload.to === 'string' ? payload.to : '/dashboard'
      navigate(to)
      return
    }

    if (intent === 'open') {
      const url = typeof payload.url === 'string' ? payload.url : undefined
      if (url && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      return
    }

    if (intent === 'copy') {
      const text = (typeof payload.text === 'string' && payload.text) || item.description
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            toast({ title: 'Copied', description: 'Text copied to clipboard' })
          })
          .catch(() => {
            toast({ title: 'Copy failed', description: 'Unable to copy to clipboard', variant: 'destructive' })
          })
      }
      return
    }

    // "toggle" and "none" are disabled/no-op
  }

  // Helpers to render model outputs robustly (support both monthlyDelta and monthly; numeric or string confidence)
  function getImpactLabel(sug: SuggestionItem): string | null {
    interface ImpactEstimateExtended {
      monthlyDelta?: number
      monthly?: number
      currency?: string
    }
    const ie = sug.impactEstimate as ImpactEstimateExtended | undefined
    if (!ie) return null
    const monthly =
      typeof ie?.monthlyDelta === 'number' ? ie.monthlyDelta : typeof ie?.monthly === 'number' ? ie.monthly : null
    const currency = typeof ie?.currency === 'string' ? ie.currency : undefined
    if (monthly == null) return null
    return `${monthly} ${currency || ''}/mo`.trim()
  }

  function getConfidenceLabel(sug: SuggestionItem): string | null {
    const c = sug.confidence as number | string
    if (typeof c === 'number') {
      const pct = Math.max(0, Math.min(1, c)) * 100
      return `${pct.toFixed(0)}%`
    }
    if (typeof c === 'string') {
      const s = c.toLowerCase()
      if (s === 'low' || s === 'medium' || s === 'high') return s
      return c
    }
    return null
  }

  const needsContrastFallback = false
  const userBubbleTextClass = needsContrastFallback ? 'text-white' : 'text-primary-foreground'

  return (
    <>
      {/* Floating FAB Button with magical animation */}
      <motion.div
        className="fixed z-[80]"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)',
          right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 1 }}
        animate={{ scale: 1 }}
      >
        <Button
          ref={fabRef}
          aria-label="Open assistant"
          className="relative rounded-full shadow-lg md:h-12 md:w-12 h-12 w-12 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 overflow-hidden group"
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          variant="default"
          size="icon"
        >
          {/* Pulsating glow effect */}
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-glow" />

          {/* Sparkle orbit effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="animate-sparkle-orbit">
                <SparkleIcon className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
          </div>

          <SparkleIcon className="relative h-6 w-6 z-10" />
          <span className="sr-only">Open assistant</span>
        </Button>

        {/* Reduced motion fallback */}
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .animate-pulse-glow,
            .animate-sparkle-orbit,
            .animate-sparkle {
              animation: none !important;
            }
          }
        `}</style>
      </motion.div>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          aria-label="Gemini assistant panel"
          className="w-full sm:max-w-lg p-0 flex flex-col h-[100dvh] bg-gradient-to-b from-background via-background to-background/95"
        >
          <div className="flex h-full flex-col">
            <div className="sticky top-0 z-10 border-b bg-background/95 px-4 pt-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Gemini Assistant</h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMessages([])}
                    disabled={isSending}
                    title="Clear chat"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="mt-3">
                <Tabs defaultValue="chat" value={activeTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-1">
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden px-3 pb-3">
              <Tabs value={activeTab} className="h-full min-h-0">
                {/* Chat Tab */}
                <TabsContent value="chat" className="mt-2 h-full min-h-0 flex flex-col">
                  <div
                    ref={listRef}
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pr-2"
                    aria-live="polite"
                    aria-atomic="false"
                  >
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center px-4 space-y-2">
                        <SparkleIcon className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">Start a conversation with the assistant.</p>
                        <p className="text-xs text-muted-foreground/70">
                          Ask about your subscriptions, get recommendations, or explore insights.
                        </p>
                      </div>
                    ) : null}
                    {messages.map((m, idx) => {
                      const isUser = m.role === 'user'
                      const isLatest = idx === messages.length - 1
                      return (
                        <div
                          key={`msg-${idx}-${m.content.slice(0, 20)}`}
                          className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            isUser
                              ? `ml-auto bg-primary ${userBubbleTextClass} rounded-br-md`
                              : 'mr-auto bg-gradient-to-br from-muted to-muted/50 text-foreground backdrop-blur-sm rounded-bl-md border border-border/50'
                          }`}
                        >
                          {isUser ? (
                            m.content
                          ) : (
                            <AssistantMessage content={m.content} isLatest={isLatest && !isSending} />
                          )}
                        </div>
                      )
                    })}
                    {sendPhase !== 'idle' && (
                      <div className="max-w-[85%] mr-auto">
                        <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-gradient-to-br from-muted to-muted/50 backdrop-blur-sm border border-border/50 shadow-sm">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner className="h-3 w-3" />
                            <span>{sendPhase === 'ack' ? 'Message sent...' : 'Thinking...'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="h-px" />
                  </div>

                  <div className="mt-2 border-t pt-3 sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    {sendPhase !== 'idle' && (
                      <div className="mb-2 px-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {sendPhase === 'ack' && (
                            <>
                              <svg
                                className="h-3 w-3 text-green-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                aria-hidden="true"
                              >
                                <title>Message sent</title>
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>Message sent • Waiting for Gemini</span>
                            </>
                          )}
                          {sendPhase === 'thinking' && (
                            <>
                              <Spinner className="h-3 w-3" />
                              <span>Gemini is thinking...</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 relative">
                        <Textarea
                          ref={textareaRef}
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={handleKeyDownTextarea}
                          onInput={(e) => {
                            const t = e.currentTarget
                            t.style.height = 'auto'
                            t.style.height = `${Math.min(t.scrollHeight, 240)}px`
                          }}
                          rows={2}
                          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                          className="min-h-[44px] max-h-60 rounded-xl bg-muted/50 border-border/50 shadow-sm resize-none"
                          disabled={sendPhase === 'thinking'}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={sendPhase === 'thinking' || !inputText.trim()}
                        className="h-[44px] px-4 rounded-xl shadow-sm"
                      >
                        {sendPhase === 'thinking' ? (
                          <span className="inline-flex items-center gap-2">
                            <Spinner className="h-4 w-4" />
                          </span>
                        ) : sendPhase === 'ack' ? (
                          <span className="inline-flex items-center gap-2">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <title>Sent</title>
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        ) : (
                          'Send'
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

async function safeJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}
