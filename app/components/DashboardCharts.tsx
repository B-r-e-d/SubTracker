import { useLoaderData } from '@remix-run/react'
import type { TooltipItem } from 'chart.js'
import * as React from 'react'
import ClientChart from '~/components/charts/ClientChart'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { addCycle, monthlyEquivalent, parseDate } from '~/lib/billing'
import type { loader as dashboardLoader } from '~/routes/dashboard'
import useSubscriptionStore from '~/store/subscriptionStore'
import { usePreferencesStore } from '~/stores/preferences'

const MONTHS_AHEAD = 6

export default function DashboardCharts() {
  // Access rates from the dashboard route loader (type-only import avoids runtime cycle)
  const { rates } = useLoaderData<typeof dashboardLoader>()
  const { selectedCurrency } = usePreferencesStore()
  const subscriptions = useSubscriptionStore((s) => s.subscriptions)

  // Helper to convert an amount from a given currency -> selectedCurrency using rates with USD base
  const convertToSelected = React.useCallback(
    (amount: number, fromCurrency: string) => {
      if (!rates) return amount
      const fromRate = rates[fromCurrency] ?? 1
      const targetRate = rates[selectedCurrency] ?? 1
      if (!fromRate || !targetRate) return amount
      return amount * (targetRate / fromRate)
    },
    [rates, selectedCurrency],
  )

  const formatCurrency = React.useCallback(
    (value: number) => {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: selectedCurrency,
          maximumFractionDigits: 0,
        }).format(value)
      } catch {
        return `${selectedCurrency} ${value}`
      }
    },
    [selectedCurrency],
  )

  // Pie: monthly-equivalent cost per subscription, so yearly plans are comparable.
  const pieAggregation = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const sub of subscriptions) {
      const monthly = monthlyEquivalent(sub.price, sub.billingCycle ?? 'monthly')
      const converted = convertToSelected(monthly, sub.currency)
      map.set(sub.name, (map.get(sub.name) || 0) + converted)
    }
    const labels: string[] = []
    const values: number[] = []
    for (const [name, value] of map.entries()) {
      labels.push(name)
      values.push(value)
    }
    return { labels, values }
  }, [subscriptions, convertToSelected])

  /**
   * Bar chart: walk each subscription's renewal date forward by its billing cycle
   * and bucket the charges into the next six calendar months. Derived from real
   * data rather than a hardcoded series.
   */
  const projection = React.useMemo(() => {
    const now = new Date()
    const labels: string[] = []
    const values: number[] = []
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      labels.push(d.toLocaleString('en-US', { month: 'short', year: '2-digit' }))
      values.push(0)
    }

    const windowEnd = new Date(now.getFullYear(), now.getMonth() + MONTHS_AHEAD, 1)

    for (const sub of subscriptions) {
      const start = parseDate(sub.nextRenewal)
      if (!start) continue
      const cycle = sub.billingCycle ?? 'monthly'
      const amount = convertToSelected(sub.price, sub.currency)
      let cursor = start
      let guard = 0
      while (cursor < windowEnd && guard < 400) {
        const index = (cursor.getFullYear() - now.getFullYear()) * 12 + (cursor.getMonth() - now.getMonth())
        if (index >= 0 && index < MONTHS_AHEAD) values[index] += amount
        cursor = addCycle(cursor, cycle)
        guard++
      }
    }

    return { labels, values }
  }, [subscriptions, convertToSelected])

  const pieData = {
    labels: pieAggregation.labels,
    datasets: [
      {
        label: 'Monthly expense',
        data: pieAggregation.values,
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4', '#a78bfa'],
        hoverOffset: 8,
      },
    ],
  }

  const pieOptions = {
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 16, boxHeight: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'pie'>) => {
            const raw = Number(ctx.parsed)
            return `${ctx.label}: ${formatCurrency(raw)}/mo`
          },
        },
      },
    },
  }

  const barData = {
    labels: projection.labels,
    datasets: [
      {
        label: 'Scheduled charges',
        data: projection.values,
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.6,
      },
    ],
  }

  const barOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => {
            const parsed = ctx.parsed
            const raw =
              typeof parsed === 'number' ? parsed : typeof parsed === 'object' && parsed !== null ? (parsed.y ?? 0) : 0
            return ` ${formatCurrency(raw)}`
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        ticks: {
          callback: (value: string | number) => {
            const n = Number(value)
            return formatCurrency(n)
          },
        },
      },
      x: {
        grid: { display: false },
      },
    },
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="h-[380px]">
        <CardHeader>
          <CardTitle>Monthly expenses by subscription</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ClientChart type="pie" data={pieData} options={pieOptions} className="h-full w-full" />
        </CardContent>
      </Card>

      <Card className="h-[380px]">
        <CardHeader>
          <CardTitle>Projected charges (next 6 months)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ClientChart type="bar" data={barData} options={barOptions} className="h-full w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
