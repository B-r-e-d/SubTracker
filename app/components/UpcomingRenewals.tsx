import { CalendarClock } from 'lucide-react'
import { useMemo } from 'react'
import { Card, CardContent } from '~/components/ui/card'
import { CYCLE_SUFFIX, DEFAULT_CYCLE, daysUntil, formatShortDate } from '~/lib/billing'
import type { Subscription } from '~/store/subscriptionStore'

interface UpcomingRenewalsProps {
  subscriptions: Subscription[]
  /** How far ahead to look, in days. */
  horizonDays?: number
}

export default function UpcomingRenewals({ subscriptions, horizonDays = 30 }: UpcomingRenewalsProps) {
  const upcoming = useMemo(() => {
    return subscriptions
      .map((sub) => ({ sub, days: daysUntil(sub.nextRenewal) }))
      .filter((entry): entry is { sub: Subscription; days: number } => entry.days !== null && entry.days <= horizonDays)
      .sort((a, b) => a.days - b.days)
  }, [subscriptions, horizonDays])

  if (upcoming.length === 0) return null

  const dueSoonCount = upcoming.filter((entry) => entry.days <= 7).length

  return (
    <Card className="mb-6 bg-card shadow-lg">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Upcoming renewals</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {dueSoonCount > 0 ? `${dueSoonCount} due within 7 days` : `Next ${horizonDays} days`}
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {upcoming.map(({ sub, days }) => {
            const cycle = sub.billingCycle ?? DEFAULT_CYCLE
            const tone =
              days < 0
                ? 'border-destructive/40 bg-destructive/10'
                : days <= 7
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-border bg-muted/40'
            const badgeTone =
              days < 0 ? 'text-destructive' : days <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'

            return (
              <div key={sub.id} className={`shrink-0 rounded-lg border px-3 py-2.5 min-w-[150px] ${tone}`}>
                <p className="text-sm font-medium text-foreground truncate max-w-[150px]" title={sub.name}>
                  {sub.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatShortDate(sub.nextRenewal)}</p>
                <div className="flex items-baseline justify-between gap-2 mt-1.5">
                  <span className="text-sm font-semibold text-foreground">
                    {sub.currency} {sub.price}
                    <span className="text-xs font-normal text-muted-foreground">/{CYCLE_SUFFIX[cycle]}</span>
                  </span>
                  <span className={`text-xs font-medium whitespace-nowrap ${badgeTone}`}>
                    {days < 0 ? `${Math.abs(days)}d late` : days === 0 ? 'today' : `${days}d`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
