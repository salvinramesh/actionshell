import { create } from 'zustand'

type View = 'terminal' | 'admin' | 'settings' | 'tunnels'
type Theme = 'dark' | 'light' | 'system'

interface UIStore {
  theme: Theme
  currentView: View
  sidebarCollapsed: boolean
  showSnippetPalette: boolean
  showConnectionForm: boolean
  editingHostId: string | null
  notifications: Notification[]
  termTheme: string
  termFontSize: number
  termFontFamily: string
  termFontColor: string
  termBgColor: string
  logHighlightActive: boolean
  defaultShell: string
  customShellPath: string

  setTheme: (t: Theme) => void
  setView: (v: View) => void
  toggleSidebar: () => void
  setShowSnippetPalette: (v: boolean) => void
  setShowConnectionForm: (v: boolean, hostId?: string) => void
  addNotification: (n: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  setTermTheme: (t: string) => void
  setTermFontSize: (s: number) => void
  setTermFontFamily: (f: string) => void
  setTermFontColor: (c: string) => void
  setTermBgColor: (c: string) => void
  setLogHighlightActive: (v: boolean) => void
  setDefaultShell: (s: string) => void
  setCustomShellPath: (p: string) => void
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

export const useUIStore = create<UIStore>((set) => ({
  theme: (localStorage.getItem('actionshell_theme') as Theme) || 'dark',
  currentView: 'terminal',
  sidebarCollapsed: false,
  showSnippetPalette: false,
  showConnectionForm: false,
  editingHostId: null,
  notifications: [],
  termTheme: localStorage.getItem('actionshell_term_theme') || 'dark',
  termFontSize: parseInt(localStorage.getItem('actionshell_term_font_size') || '13'),
  termFontFamily: localStorage.getItem('actionshell_term_font_family') || "'JetBrains Mono', monospace",
  termFontColor: localStorage.getItem('actionshell_term_font_color') || '#CDD6F4',
  termBgColor: localStorage.getItem('actionshell_term_bg_color') || '#0A0E1A',
  logHighlightActive: localStorage.getItem('actionshell_log_highlight_active') !== 'false',
  defaultShell: localStorage.getItem('actionshell_default_shell') || 'zsh',
  customShellPath: localStorage.getItem('actionshell_custom_shell_path') || '',

  setTheme: (theme) => {
    set({ theme })
    localStorage.setItem('actionshell_theme', theme)
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
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
  })),

  setTermTheme: (termTheme) => {
    set({ termTheme })
    localStorage.setItem('actionshell_term_theme', termTheme)
  },
  setTermFontSize: (termFontSize) => {
    set({ termFontSize })
    localStorage.setItem('actionshell_term_font_size', String(termFontSize))
  },
  setTermFontFamily: (termFontFamily) => {
    set({ termFontFamily })
    localStorage.setItem('actionshell_term_font_family', termFontFamily)
  },
  setTermFontColor: (termFontColor) => {
    set({ termFontColor })
    localStorage.setItem('actionshell_term_font_color', termFontColor)
  },
  setTermBgColor: (termBgColor) => {
    set({ termBgColor })
    localStorage.setItem('actionshell_term_bg_color', termBgColor)
  },
  setLogHighlightActive: (logHighlightActive) => {
    set({ logHighlightActive })
    localStorage.setItem('actionshell_log_highlight_active', String(logHighlightActive))
  },
  setDefaultShell: (defaultShell) => {
    set({ defaultShell })
    localStorage.setItem('actionshell_default_shell', defaultShell)
  },
  setCustomShellPath: (customShellPath) => {
    set({ customShellPath })
    localStorage.setItem('actionshell_custom_shell_path', customShellPath)
  },
}))
