import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import * as React from 'react'
import DashboardCharts from '~/components/DashboardCharts'
import DeleteConfirmationDialog from '~/components/DeleteConfirmationDialog'
import EditSubscriptionModal from '~/components/EditSubscriptionModal'
import Header from '~/components/Header'
import SearchBar from '~/components/SearchBar'
import SubscriptionGrid from '~/components/SubscriptionGrid'
import Summary from '~/components/Summary'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { getCacheHeaders, getCurrencyRates } from '~/services/currency.server'
import useSubscriptionStore, { type Subscription } from '~/store/subscriptionStore'
import { usePreferencesStore } from '~/stores/preferences'

export const meta: MetaFunction = () => {
  return [
    { title: 'LedgerLeaf - Subscription Tracker' },
    { name: 'description', content: 'Track and manage recurring subscriptions.' },
  ]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const data = await getCurrencyRates()

  return json(
    {
      rates: data?.rates ?? null,
      lastUpdated: data?.date ?? null,
    },
    {
      headers: getCacheHeaders(data?.date),
    },
  )
}

export default function Index() {
  const { rates, lastUpdated } = useLoaderData<typeof loader>()
  const { selectedCurrency, setSelectedCurrency } = usePreferencesStore()

  const subscriptions = useSubscriptionStore((s) => s.subscriptions)
  const addSubscription = useSubscriptionStore((s) => s.addSubscription)
  const editSubscription = useSubscriptionStore((s) => s.editSubscription)
  const deleteSubscription = useSubscriptionStore((s) => s.deleteSubscription)

  const [query, setQuery] = React.useState('')
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [editingSubscription, setEditingSubscription] = React.useState<Subscription | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null)

  const filteredSubscriptions = React.useMemo(() => {
    if (!query) return subscriptions
    const q = query.toLowerCase()
    return subscriptions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q) || s.currency.toLowerCase().includes(q),
    )
  }, [subscriptions, query])

  const totals = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of subscriptions) {
      map[s.currency] = (map[s.currency] || 0) + s.price
    }
    return map
  }, [subscriptions])

  const handleSearch = (q: string) => setQuery(q)

  const handleOpenAdd = () => {
    setEditingSubscription(null)
    setIsEditOpen(true)
  }

  const handleEditSubscription = (id: string) => {
    const sub = subscriptions.find((s) => s.id === id) ?? null
    setEditingSubscription(sub)
    setIsEditOpen(true)
  }

  const handleDeleteSubscription = (id: string) => {
    const sub = subscriptions.find((s) => s.id === id)
    if (!sub) return
    setDeleteTarget({ id: sub.id, name: sub.name })
    setIsDeleteOpen(true)
  }

  const handleSave = (payload: Omit<Subscription, 'id'>) => {
    if (editingSubscription) {
      editSubscription(editingSubscription.id, payload)
    } else {
      addSubscription(payload)
    }
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    deleteSubscription(deleteTarget.id)
    setIsDeleteOpen(false)
    setDeleteTarget(null)
  }

  const [view, setView] = React.useState<'dashboard' | 'home'>('home')

  return (
    <div className="min-h-screen bg-background">
      <Header view={view} setView={setView} rates={rates} />
      <main className="container mx-auto py-6 px-3 sm:px-4 lg:px-6">
        {view === 'dashboard' ? (
          <>
            <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-card via-card to-muted/30 border border-border/50 shadow-lg backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-center sm:text-left">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 dark:from-violet-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2 animate-in fade-in slide-in-from-bottom-3 duration-500">
                    Dashboard
                  </h2>
                  <p className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700">
                    Visualize subscription spending and monthly totals
                  </p>
                </div>

                {rates ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-3 duration-500">
                    <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                      <SelectTrigger className="w-[96px] bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all">
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(rates).map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>

            <DashboardCharts />
          </>
        ) : (
          <>
            <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-card via-card to-muted/30 border border-border/50 shadow-lg backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 dark:from-blue-400 dark:via-cyan-400 dark:to-teal-400 bg-clip-text text-transparent mb-2 animate-in fade-in slide-in-from-bottom-3 duration-500">
                    Subscriptions
                  </h2>
                  <p className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700">
                    Manage and edit your recurring subscriptions
                  </p>
                </div>
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-3 duration-500">
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 dark:from-blue-500 dark:to-cyan-500 dark:hover:from-blue-600 dark:hover:to-cyan-600 text-white px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <span className="relative">Add</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Summary totals={totals} />
              <SearchBar onSearch={handleSearch} />
              <SubscriptionGrid
                subscriptions={filteredSubscriptions}
                onEditSubscription={handleEditSubscription}
                onDeleteSubscription={handleDeleteSubscription}
              />
              <EditSubscriptionModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                onSave={handleSave}
                editingSubscription={editingSubscription}
              />
              <DeleteConfirmationDialog
                isOpen={isDeleteOpen}
                onClose={() => {
                  setIsDeleteOpen(false)
                  setDeleteTarget(null)
                }}
                onConfirm={handleConfirmDelete}
                subscriptionName={deleteTarget?.name ?? ''}
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
