import { create } from 'zustand'

type View = 'terminal' | 'admin' | 'settings'
type Theme = 'dark' | 'light'

interface UIStore {
  theme: Theme
  currentView: View
  sidebarCollapsed: boolean
  showSnippetPalette: boolean
  showConnectionForm: boolean
  editingHostId: string | null
  notifications: Notification[]

  setTheme: (t: Theme) => void
  setView: (v: View) => void
  toggleSidebar: () => void
  setShowSnippetPalette: (v: boolean) => void
  setShowConnectionForm: (v: boolean, hostId?: string) => void
  addNotification: (n: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

export const useUIStore = create<UIStore>((set) => ({
  theme: 'dark',
  currentView: 'terminal',
  sidebarCollapsed: false,
  showSnippetPalette: false,
  showConnectionForm: false,
  editingHostId: null,
  notifications: [],

  setTheme: (theme) => {
    set({ theme })
    document.documentElement.setAttribute('data-theme', theme)
  },

  setView: (currentView) => set({ currentView }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setShowSnippetPalette: (v) => set({ showSnippetPalette: v }),

  setShowConnectionForm: (v, hostId) => set({
    showConnectionForm: v,
    editingHostId: hostId ?? null
  }),

  addNotification: (n) => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ notifications: [...s.notifications, { ...n, id }] }))
    const duration = n.duration ?? 4000
    if (duration > 0) setTimeout(() => {
      set(s => ({ notifications: s.notifications.filter(x => x.id !== id) }))
    }, duration)
  },

  removeNotification: (id) => set(s => ({
    notifications: s.notifications.filter(n => n.id !== id)
  }))
}))
