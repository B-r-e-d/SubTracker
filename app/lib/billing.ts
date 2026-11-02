import { addMonths, addWeeks, addYears, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export const BILLING_CYCLES: readonly BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly']

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

/** Short label used on cards, e.g. "mo", "yr". */
export const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  weekly: 'wk',
  monthly: 'mo',
  quarterly: 'qtr',
  yearly: 'yr',
}

/** How many months one billing period covers. */
export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  weekly: 12 / 52,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
}

export const DEFAULT_CYCLE: BillingCycle = 'monthly'

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && (BILLING_CYCLES as readonly string[]).includes(value)
}

/** Normalise any price to its monthly cost. */
export function monthlyEquivalent(price: number, cycle: BillingCycle): number {
  const months = CYCLE_MONTHS[cycle] || 1
  return price / months
}

export function annualEquivalent(price: number, cycle: BillingCycle): number {
  return monthlyEquivalent(price, cycle) * 12
}

/** Advance a date by exactly one billing period. */
export function addCycle(date: Date, cycle: BillingCycle): Date {
  switch (cycle) {
    case 'weekly':
      return addWeeks(date, 1)
    case 'quarterly':
      return addMonths(date, 3)
    case 'yearly':
      return addYears(date, 1)
    default:
      return addMonths(date, 1)
  }
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  try {
    const parsed = parseISO(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  } catch {
    return null
  }
}

/** Days from today until the given ISO date. Negative when overdue. */
export function daysUntil(value: string | undefined): number | null {
  const date = parseDate(value)
  if (!date) return null
  return differenceInCalendarDays(startOfDay(date), startOfDay(new Date()))
}

export function formatShortDate(value: string | undefined): string {
  const date = parseDate(value)
  return date ? format(date, 'd MMM yyyy') : 'Not set'
}

/** Human phrasing for a renewal date. */
export function describeRenewal(value: string | undefined): string {
  const days = daysUntil(value)
  if (days === null) return 'No renewal date'
  if (days < 0) return `Overdue by ${Math.abs(days)}d`
  if (days === 0) return 'Renews today'
  if (days === 1) return 'Renews tomorrow'
  if (days <= 30) return `Renews in ${days}d`
  return `Renews ${formatShortDate(value)}`
}
