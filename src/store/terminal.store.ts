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

export type LayoutType = 'single' | 'split-v' | 'split-h' | 'grid'

interface TerminalStore {
  tabs: TerminalTab[]
  activeTabId: string | null
  broadcastActive: boolean
  
  // Split Layout State
  layout: LayoutType
  panes: (string | null)[] // [pane0, pane1, pane2, pane3]
  activePaneIndex: number
  
  addTab: (tab: Omit<TerminalTab, 'id'>) => string
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, data: Partial<TerminalTab>) => void
  toggleSftp: (id: string) => void
  getActiveTab: () => TerminalTab | null
  setBroadcastActive: (v: boolean) => void
  
  // Layout actions
  setLayout: (layout: LayoutType) => void
  setActivePane: (index: number) => void
  setPaneTab: (paneIndex: number, tabId: string | null) => void
  splitPane: (sourceTabId: string, targetPaneIndex: number, direction: 'left' | 'right' | 'top' | 'bottom' | 'center') => void
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  broadcastActive: false,
  layout: 'single',
  panes: [null, null, null, null],
  activePaneIndex: 0,

  addTab: (tab) => {
    const id = uuidv4()
    set(s => {
      const newTabs = [...s.tabs, { ...tab, id }]
      const newPanes = [...s.panes]
      newPanes[s.activePaneIndex] = id
      if (s.layout === 'single') {
        newPanes[0] = id
      }
      return { tabs: newTabs, panes: newPanes, activeTabId: id }
    })
    return id
  },

  removeTab: (id) => {
    set(s => {
      const idx = s.tabs.findIndex(t => t.id === id)
      const newTabs = s.tabs.filter(t => t.id !== id)
      const newPanes = s.panes.map(p => p === id ? null : p)

      if (newTabs.length === 0) {
        return {
          tabs: [],
          panes: [null, null, null, null],
          activePaneIndex: 0,
          activeTabId: null,
          layout: 'single'
        }
      }

      if (newPanes[s.activePaneIndex] === null) {
        const unassigned = newTabs.find(t => !newPanes.includes(t.id))
        if (unassigned) {
          newPanes[s.activePaneIndex] = unassigned.id
        } else {
          const fallback = newPanes.find(p => p !== null) || newTabs[0]?.id || null
          newPanes[s.activePaneIndex] = fallback
        }
      }

      const activeTabId = newPanes[s.activePaneIndex]

      return {
        tabs: newTabs,
        panes: newPanes,
        activeTabId
      }
    })
  },

  setActiveTab: (id) => set(s => {
    const newPanes = [...s.panes]
    const existing = newPanes.indexOf(id)
    if (existing !== -1) {
      newPanes[existing] = newPanes[s.activePaneIndex]
    }
    newPanes[s.activePaneIndex] = id
    return { panes: newPanes, activeTabId: id }
  }),

  updateTab: (id, data) => set(s => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, ...data } : t)
  })),

  toggleSftp: (id) => set(s => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, showSftp: !t.showSftp } : t)
  })),

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find(t => t.id === activeTabId) ?? null
  },

  setBroadcastActive: (broadcastActive) => set({ broadcastActive }),

  setLayout: (layout) => set(s => {
    const newPanes = [...s.panes]
    if (layout === 'single') {
      const currentTab = s.panes[s.activePaneIndex] || s.activeTabId || (s.tabs[0]?.id ?? null)
      return {
        layout,
        panes: [currentTab, null, null, null],
        activePaneIndex: 0,
        activeTabId: currentTab
      }
    }

    const maxPanes = layout === 'grid' ? 4 : 2
    for (let i = 0; i < maxPanes; i++) {
      if (!newPanes[i]) {
        const unassigned = s.tabs.find(t => !newPanes.slice(0, i).includes(t.id))
        if (unassigned) {
          newPanes[i] = unassigned.id
        } else {
          newPanes[i] = null
        }
      }
    }

    return {
      layout,
      panes: newPanes
    }
  }),

  setActivePane: (index) => set(s => ({
    activePaneIndex: index,
    activeTabId: s.panes[index] || s.activeTabId
  })),

  setPaneTab: (paneIndex, tabId) => set(s => {
    const newPanes = [...s.panes]
    if (tabId) {
      const existing = newPanes.indexOf(tabId)
      if (existing !== -1) {
        newPanes[existing] = null
      }
    }
    newPanes[paneIndex] = tabId
    return {
      panes: newPanes,
      activeTabId: paneIndex === s.activePaneIndex ? tabId : s.activeTabId
    }
  }),

  splitPane: (sourceTabId, targetPaneIndex, direction) => set(s => {
    const newPanes = [...s.panes]
    const prevIdx = newPanes.indexOf(sourceTabId)
    if (prevIdx !== -1) {
      newPanes[prevIdx] = null
    }

    if (direction === 'center') {
      newPanes[targetPaneIndex] = sourceTabId
      return { panes: newPanes, activeTabId: sourceTabId, activePaneIndex: targetPaneIndex }
    }

    let nextLayout = s.layout
    if (s.layout === 'single') {
      nextLayout = (direction === 'left' || direction === 'right') ? 'split-v' : 'split-h'
      const targetTab = newPanes[0]
      if (direction === 'left' || direction === 'top') {
        newPanes[0] = sourceTabId
        newPanes[1] = targetTab
        return { layout: nextLayout, panes: newPanes, activePaneIndex: 0, activeTabId: sourceTabId }
      } else {
        newPanes[0] = targetTab
        newPanes[1] = sourceTabId
        return { layout: nextLayout, panes: newPanes, activePaneIndex: 1, activeTabId: sourceTabId }
      }
    } else if (s.layout === 'split-v' || s.layout === 'split-h') {
      nextLayout = 'grid'
      if (targetPaneIndex === 0) {
        newPanes[2] = sourceTabId
      } else {
        newPanes[3] = sourceTabId
      }
      return { layout: nextLayout, panes: newPanes, activePaneIndex: targetPaneIndex === 0 ? 2 : 3, activeTabId: sourceTabId }
    }

    newPanes[targetPaneIndex] = sourceTabId
    return { panes: newPanes, activeTabId: sourceTabId, activePaneIndex: targetPaneIndex }
  })
}))
