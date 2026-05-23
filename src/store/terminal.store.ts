import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export type TabType = 'ssh' | 'local' | 'sftp'

export interface TerminalTab {
  id: string
  sessionId: string
  title: string
  type: TabType
  hostId?: string
  hostname?: string
  isLocal?: boolean
  status: 'connecting' | 'connected' | 'closed' | 'error'
  sftpSessionId?: string
  showSftp?: boolean
}

interface TerminalStore {
  tabs: TerminalTab[]
  activeTabId: string | null
  addTab: (tab: Omit<TerminalTab, 'id'>) => string
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, data: Partial<TerminalTab>) => void
  toggleSftp: (id: string) => void
  getActiveTab: () => TerminalTab | null
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) => {
    const id = uuidv4()
    set(s => ({ tabs: [...s.tabs, { ...tab, id }], activeTabId: id }))
    return id
  },

  removeTab: (id) => {
    set(s => {
      const idx = s.tabs.findIndex(t => t.id === id)
      const newTabs = s.tabs.filter(t => t.id !== id)
      let newActive = s.activeTabId
      if (newActive === id) {
        newActive = newTabs[Math.max(0, idx - 1)]?.id ?? newTabs[0]?.id ?? null
      }
      return { tabs: newTabs, activeTabId: newActive }
    })
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, data) => set(s => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, ...data } : t)
  })),

  toggleSftp: (id) => set(s => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, showSftp: !t.showSftp } : t)
  })),

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find(t => t.id === activeTabId) ?? null
  }
}))
