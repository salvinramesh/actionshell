import { create } from 'zustand'
import type { SSHHost, HostGroup } from '../../shared/types'

interface ConnectionsStore {
  hosts: SSHHost[]
  groups: HostGroup[]
  selectedHostId: string | null
  searchQuery: string
  isLoading: boolean

  setHosts: (hosts: SSHHost[]) => void
  setGroups: (groups: HostGroup[]) => void
  setSelectedHost: (id: string | null) => void
  setSearch: (q: string) => void
  setLoading: (l: boolean) => void
  updateHostStatus: (id: string, status: SSHHost['status']) => void

  loadHosts: (userId: string, userRole: string) => Promise<void>
  loadGroups: () => Promise<void>

  filteredHosts: () => SSHHost[]
}

export const useConnectionsStore = create<ConnectionsStore>((set, get) => ({
  hosts: [],
  groups: [],
  selectedHostId: null,
  searchQuery: '',
  isLoading: false,

  setHosts: (hosts) => set({ hosts }),
  setGroups: (groups) => set({ groups }),
  setSelectedHost: (id) => set({ selectedHostId: id }),
  setSearch: (searchQuery) => set({ searchQuery }),
  setLoading: (isLoading) => set({ isLoading }),

  updateHostStatus: (id, status) => {
    set(s => ({
      hosts: s.hosts.map(h => h.id === id ? { ...h, status } : h)
    }))
  },

  loadHosts: async (userId, userRole) => {
    set({ isLoading: true })
    try {
      const res = await window.actionshell.connections.list(userId, userRole)
      if (res.success) set({ hosts: res.data as SSHHost[] })
    } finally {
      set({ isLoading: false })
    }
  },

  loadGroups: async () => {
    const res = await window.actionshell.connections.groupsList()
    if (res.success) set({ groups: res.data as HostGroup[] })
  },

  filteredHosts: () => {
    const { hosts, searchQuery } = get()
    if (!searchQuery) return hosts
    const q = searchQuery.toLowerCase()
    return hosts.filter(h =>
      h.name.toLowerCase().includes(q) ||
      h.hostname.toLowerCase().includes(q) ||
      (h.username || '').toLowerCase().includes(q) ||
      h.tags.some(t => t.toLowerCase().includes(q))
    )
  }
}))
