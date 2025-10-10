import { Home, LayoutDashboard } from 'lucide-react'
import type * as React from 'react'
import useSubscriptionStore from '~/store/subscriptionStore'
import AddSubscriptionPopover from './AddSubscriptionPopover'
import { Button } from './ui/button'

type View = 'dashboard' | 'home'

interface HeaderProps {
  view: View
  setView: React.Dispatch<React.SetStateAction<View>>
  rates: Record<string, number> | null
}

const Header = ({ view, setView, rates }: HeaderProps): JSX.Element => {
  const { addSubscription } = useSubscriptionStore()

  return (
    <header className="border-b border-border/40 bg-gradient-to-r from-background via-background to-muted/20 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 dark:from-emerald-500 dark:via-green-600 dark:to-teal-700 flex items-center justify-center shadow-lg ring-2 ring-emerald-400/20 dark:ring-emerald-500/20 transition-transform hover:scale-110 duration-300">
              <span className="text-xl filter drop-shadow-sm">🍃</span>
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/20 to-transparent animate-pulse" />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 dark:from-emerald-400 dark:via-green-400 dark:to-teal-400 bg-clip-text text-transparent">
                LedgerLeaf
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                Track and manage recurring subscriptions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                console.log('Toggle button clicked, current view:', view)
                setView(view === 'dashboard' ? 'home' : 'dashboard')
              }}
              variant="outline"
              size="default"
              className="group relative overflow-hidden transition-all hover:shadow-md hover:scale-105"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-green-400/10 to-teal-400/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              {view === 'home' ? (
                <>
                  <LayoutDashboard className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" />
                  Dashboard
                </>
              ) : (
                <>
                  <Home className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                  Home
                </>
              )}
            </Button>

            <div className="min-w-[140px]">
              <AddSubscriptionPopover addSubscription={addSubscription} rates={rates} />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
