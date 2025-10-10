import { useLoaderData } from '@remix-run/react'
import type { TooltipItem } from 'chart.js'
import * as React from 'react'
import ClientChart from '~/components/charts/ClientChart'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import type { loader as dashboardLoader } from '~/routes/dashboard'
import useSubscriptionStore from '~/store/subscriptionStore'
import { usePreferencesStore } from '~/stores/preferences'

function lastSixMonthLabels(): string[] {
  const labels: string[] = []
  const ref = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
    labels.push(label)
  }
  return labels
}

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

  // Build pie chart data from real subscriptions (aggregate by name)
  const pieAggregation = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const sub of subscriptions) {
      const converted = convertToSelected(sub.price, sub.currency)
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

  // Historical mock totals (base INR) - keep for previous months, replace latest with current total
  const barLabels = lastSixMonthLabels()
  const barValuesINR = [4200, 4380, 4120, 4590, 4720, 4610]
  const inrToSelectedFactor = React.useMemo(() => {
    if (!rates) return 1
    const baseCurrency = 'INR' as const
    const inr = rates[baseCurrency] ?? 1
    const target = rates[selectedCurrency] ?? 1
    if (!inr || !target) return 1
    return target / inr
  }, [rates, selectedCurrency])

  const historicalConverted = React.useMemo(
    () => barValuesINR.map((v) => v * inrToSelectedFactor),
    [barValuesINR, inrToSelectedFactor],
  )

  // Current total (sum of subscriptions converted to selected currency)
  const currentTotal = React.useMemo(() => {
    return subscriptions.reduce((acc, sub) => acc + convertToSelected(sub.price, sub.currency), 0)
  }, [subscriptions, convertToSelected])

  // Replace latest historical value with current total while keeping earlier months mock data
  const barValues = React.useMemo(() => {
    const copy = [...historicalConverted]
    if (copy.length === 0) return [currentTotal]
    copy[copy.length - 1] = currentTotal
    return copy
  }, [historicalConverted, currentTotal])

  const pieData = {
    labels: pieAggregation.labels,
    datasets: [
      {
        label: 'Monthly Expense',
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
            return `${ctx.label}: ${formatCurrency(raw)}`
          },
        },
      },
    },
  }

  const barData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Total per month',
        data: barValues,
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
          <CardTitle>Total cost per month (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ClientChart type="bar" data={barData} options={barOptions} className="h-full w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
