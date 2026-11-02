import type { MetaFunction } from '@remix-run/node'
import { useNavigate } from '@remix-run/react'
import { CreditCard, Loader2, Lock, ShieldAlert, User } from 'lucide-react'
import * as React from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import useAuthStore from '~/store/authStore'

export const meta: MetaFunction = () => {
  return [{ title: 'Sign in - SubTracker' }, { name: 'description', content: 'Sign in to SubTracker.' }]
}

type Mode = 'login' | 'register'

export default function Login() {
  const navigate = useNavigate()
  const { user, accounts, login, register } = useAuthStore()

  const [mounted, setMounted] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>('login')
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  // Auth lives in localStorage, so the gate can only run after hydration.
  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (mounted && user) navigate('/', { replace: true })
  }, [mounted, user, navigate])

  // First run: there is nothing to sign in to yet.
  React.useEffect(() => {
    if (mounted && accounts.length === 0) setMode('register')
  }, [mounted, accounts.length])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const message = mode === 'login' ? await login(username, password) : await register(username, password)
      if (message) {
        setError(message)
        return
      }
      navigate('/', { replace: true })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 dark:from-blue-500 dark:via-indigo-600 dark:to-purple-700 flex items-center justify-center shadow-lg ring-2 ring-blue-400/20 dark:ring-blue-500/20 mb-4">
            <CreditCard className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            SubTracker
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'login' ? 'Sign in to your subscriptions.' : 'Create an account to get started.'}
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/50 shadow-lg p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-1 p-1 mb-6 rounded-lg bg-muted">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'login'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'register'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your name"
                  autoComplete="username"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {mode === 'register' ? (
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••"
                    autoComplete="new-password"
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {mode === 'register' && accounts.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground text-center">
              First run — this account is stored in your browser only.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Demo mode: credentials and data are kept in this browser's local storage. Do not reuse a real password.
          </p>
        </div>
      </div>
    </div>
  )
}
