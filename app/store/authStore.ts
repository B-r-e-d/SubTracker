import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface Account {
  username: string
  passwordHash: string
  createdAt: string
}

interface AuthState {
  user: string | null
  accounts: Account[]
  login: (username: string, password: string) => Promise<string | null>
  register: (username: string, password: string) => Promise<string | null>
  logout: () => void
  deleteAccount: (username: string) => void
}

/**
 * Demo-only credential handling. Passwords are salted and SHA-256 hashed so they
 * are not stored in plain text, but everything lives in localStorage: this is
 * NOT real authentication and must be replaced before any public deployment.
 */
async function hashPassword(username: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`subtracker-demo:${username.toLowerCase()}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const normalizeName = (username: string) => username.trim()

const noopStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: [],
      register: async (username, password) => {
        const name = normalizeName(username)
        if (name.length < 3) return 'Username must be at least 3 characters.'
        if (password.length < 6) return 'Password must be at least 6 characters.'
        if (get().accounts.some((a) => a.username.toLowerCase() === name.toLowerCase())) {
          return 'That username is already taken.'
        }
        const passwordHash = await hashPassword(name, password)
        const account: Account = { username: name, passwordHash, createdAt: new Date().toISOString() }
        set((state) => ({ accounts: [...state.accounts, account], user: name }))
        return null
      },
      login: async (username, password) => {
        const name = normalizeName(username)
        const account = get().accounts.find((a) => a.username.toLowerCase() === name.toLowerCase())
        if (!account) return 'No account found with that username.'
        const passwordHash = await hashPassword(account.username, password)
        if (passwordHash !== account.passwordHash) return 'Incorrect password.'
        set({ user: account.username })
        return null
      },
      logout: () => set({ user: null }),
      deleteAccount: (username) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.username !== username),
          user: state.user === username ? null : state.user,
        })),
    }),
    {
      name: 'subtracker-auth',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : noopStorage)),
    },
  ),
)

export default useAuthStore
