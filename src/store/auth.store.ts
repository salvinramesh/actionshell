import { create } from 'zustand'
import type { AuthSession } from '../../shared/types'

const SESSION_KEY = 'actionshell_session'

interface AuthStore {
  session: AuthSession | null
  isLocked: boolean
  isLoading: boolean
  error: string | null
  setSession: (s: AuthSession | null) => void
  setLocked: (locked: boolean) => void
  setError: (e: string | null) => void
  setLoading: (l: boolean) => void
  logout: () => Promise<void>
  restoreSession: () => Promise<AuthSession | null>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  isLocked: false,
  isLoading: false,
  error: null,

  setSession: (session) => {
    set({ session, isLocked: false, error: null })
    if (session) localStorage.setItem(SESSION_KEY, session.token)
    else localStorage.removeItem(SESSION_KEY)
  },

  setLocked: (isLocked) => set({ isLocked }),
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    const { session } = get()
    if (session) await window.actionshell.auth.logout(session.token)
    localStorage.removeItem(SESSION_KEY)
    set({ session: null, isLocked: false })
  },

  restoreSession: async () => {
    const token = localStorage.getItem(SESSION_KEY)
    if (!token) return null
    try {
      const res = await window.actionshell.auth.validate(token)
      if (res.success && res.data) {
        set({ session: res.data as AuthSession })
        return res.data as AuthSession
      }
    } catch {}
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}))
