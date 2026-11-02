import { addDays } from 'date-fns'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  type BillingCycle,
  DEFAULT_CYCLE,
  annualEquivalent,
  isBillingCycle,
  monthlyEquivalent,
  toISODate,
} from '~/lib/billing'

export interface Subscription {
  id: string
  name: string
  price: number
  currency: string
  domain: string
  icon?: string
  billingCycle: BillingCycle
  /** ISO date (yyyy-MM-dd). Undefined means the user has not set one. */
  nextRenewal?: string
}

export type SubscriptionInput = Omit<Subscription, 'id'>

interface SubscriptionStore {
  subscriptions: Subscription[]
  addSubscription: (subscription: SubscriptionInput) => void
  editSubscription: (id: string, updatedSubscription: Partial<SubscriptionInput>) => void
  deleteSubscription: (id: string) => void
  exportSubscriptions: () => string
  importSubscriptions: (data: string) => void
  resetToDefault: () => void
}

/** Demo data with a spread of cycles and renewal dates so the UI has something to show. */
function seed(): Subscription[] {
  const inDays = (n: number) => toISODate(addDays(new Date(), n))
  return [
    {
      id: '1',
      name: 'Netflix',
      price: 15.99,
      currency: 'USD',
      domain: 'https://netflix.com',
      billingCycle: 'monthly',
      nextRenewal: inDays(3),
    },
    {
      id: '2',
      name: 'Spotify',
      price: 9.99,
      currency: 'USD',
      domain: 'https://spotify.com',
      billingCycle: 'monthly',
      nextRenewal: inDays(11),
    },
    {
      id: '3',
      name: 'Amazon Prime',
      price: 139,
      currency: 'USD',
      domain: 'https://amazon.com',
      billingCycle: 'yearly',
      nextRenewal: inDays(64),
    },
    {
      id: '4',
      name: 'Disney+',
      price: 7.99,
      currency: 'USD',
      domain: 'https://disneyplus.com',
      billingCycle: 'monthly',
      nextRenewal: inDays(19),
    },
    {
      id: '5',
      name: 'YouTube Premium',
      price: 11.99,
      currency: 'USD',
      domain: 'https://youtube.com',
      billingCycle: 'monthly',
      nextRenewal: inDays(26),
    },
    {
      id: '6',
      name: 'Hulu',
      price: 7.99,
      currency: 'USD',
      domain: 'https://hulu.com',
      billingCycle: 'monthly',
      nextRenewal: inDays(8),
    },
    {
      id: '7',
      name: 'Apple Music',
      price: 1080,
      currency: 'JPY',
      domain: 'https://apple.com/apple-music',
      billingCycle: 'monthly',
      nextRenewal: inDays(14),
    },
    {
      id: '8',
      name: 'HBO Max',
      price: 1450,
      currency: 'JPY',
      domain: 'https://hbomax.com',
      billingCycle: 'monthly',
      nextRenewal: inDays(22),
    },
    {
      id: '9',
      name: 'Adobe Creative Cloud',
      price: 599,
      currency: 'EUR',
      domain: 'https://adobe.com',
      billingCycle: 'yearly',
      nextRenewal: inDays(120),
    },
    {
      id: '10',
      name: 'Microsoft 365',
      price: 69,
      currency: 'EUR',
      domain: 'https://microsoft.com',
      billingCycle: 'yearly',
      nextRenewal: inDays(200),
    },
    {
      id: '11',
      name: 'iCloud+',
      price: 2.99,
      currency: 'USD',
      domain: 'https://icloud.com',
      billingCycle: 'monthly',
      nextRenewal: inDays(6),
    },
    {
      id: '12',
      name: 'Gym Membership',
      price: 120,
      currency: 'USD',
      domain: 'https://example.com',
      billingCycle: 'quarterly',
      nextRenewal: inDays(41),
    },
  ]
}

export const defaultSubscriptions: Subscription[] = seed()

/**
 * Fills in fields that older saved records (pre billing-cycle) do not have.
 * Without this, persisted localStorage data would render NaN totals.
 */
export function normalizeSubscription(raw: Partial<Subscription> & { id: string }): Subscription {
  return {
    id: raw.id,
    name: raw.name ?? 'Untitled',
    price: typeof raw.price === 'number' && Number.isFinite(raw.price) ? raw.price : 0,
    currency: raw.currency ?? 'USD',
    domain: raw.domain ?? '',
    icon: raw.icon,
    billingCycle: isBillingCycle(raw.billingCycle) ? raw.billingCycle : DEFAULT_CYCLE,
    nextRenewal: raw.nextRenewal,
  }
}

const createCustomStorage = () => {
  const isBrowser = typeof window !== 'undefined'

  // On the server (SSR), provide a synchronous no-op storage
  if (!isBrowser) {
    return {
      getItem: (_key: string) => null,
      setItem: (_key: string, _value: string) => {},
      removeItem: (_key: string) => {},
    }
  }

  // In the browser, use localStorage to satisfy sync StateStorage typing
  return localStorage
}

const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      subscriptions: defaultSubscriptions,
      addSubscription: (subscription) =>
        set((state) => ({
          subscriptions: [...state.subscriptions, normalizeSubscription({ ...subscription, id: crypto.randomUUID() })],
        })),
      editSubscription: (id, updatedSubscription) =>
        set((state) => ({
          subscriptions: state.subscriptions.map((sub) => (sub.id === id ? { ...sub, ...updatedSubscription } : sub)),
        })),
      deleteSubscription: (id) =>
        set((state) => ({
          subscriptions: state.subscriptions.filter((sub) => sub.id !== id),
        })),
      exportSubscriptions: () => JSON.stringify(get().subscriptions, null, 2),
      importSubscriptions: (data) => {
        try {
          const parsedData = JSON.parse(data)
          if (Array.isArray(parsedData) && parsedData.every(isValidSubscription)) {
            set({ subscriptions: parsedData.map((s) => normalizeSubscription(s)) })
          } else {
            throw new Error('Invalid subscription data format')
          }
        } catch (error) {
          console.error('Failed to import subscriptions:', error)
          throw error
        }
      },
      resetToDefault: () => set({ subscriptions: defaultSubscriptions }),
    }),
    {
      name: 'subscription-storage',
      version: 2,
      storage: createJSONStorage(() => createCustomStorage()),
      partialize: (state) => ({ subscriptions: state.subscriptions }),
      migrate: (persisted, _version) => {
        const state = persisted as { subscriptions?: Subscription[] } | undefined
        if (state?.subscriptions) {
          return { subscriptions: state.subscriptions.map((s) => normalizeSubscription(s)) }
        }
        return state as { subscriptions: Subscription[] }
      },
      onRehydrateStorage: () => (state) => {
        if (!state || !state.subscriptions?.length) {
          useSubscriptionStore.setState({ subscriptions: defaultSubscriptions })
        }
      },
    },
  ),
)

// Type guard for subscription validation (billing fields are optional on import)
function isValidSubscription(sub: unknown): sub is Subscription {
  if (typeof sub !== 'object' || sub === null) {
    return false
  }
  const obj = sub as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.price === 'number' &&
    typeof obj.currency === 'string' &&
    typeof obj.domain === 'string' &&
    (obj.icon === undefined || typeof obj.icon === 'string') &&
    (obj.billingCycle === undefined || isBillingCycle(obj.billingCycle)) &&
    (obj.nextRenewal === undefined || typeof obj.nextRenewal === 'string')
  )
}

export { monthlyEquivalent, annualEquivalent }
export default useSubscriptionStore
