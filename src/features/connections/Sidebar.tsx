import { useState } from 'react'
import { Server, Star, FolderOpen, ChevronDown, ChevronRight, Plus, Search, PanelLeftClose, PanelLeftOpen, Terminal, Folder, FolderPlus, MoreVertical, Zap } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useUIStore } from '../../store/ui.store'
import { useConnectionsStore } from '../../store/connections.store'
import { useTerminalStore } from '../../store/terminal.store'
import type { SSHHost, HostGroup } from '../../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import '../layout/Layout.css'

export default function Sidebar() {
  const { session } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar, setShowConnectionForm } = useUIStore()
  const { filteredHosts, groups, searchQuery, setSearch, selectedHostId, setSelectedHost, hosts } = useConnectionsStore()
  const { addTab } = useTerminalStore()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['__favorites__', '__ungrouped__']))

  const isAdmin = session?.role === 'super_admin' || session?.role === 'admin'
  const displayed = filteredHosts()
  const favorites = displayed.filter(h => h.isFavorite)
  const ungrouped = displayed.filter(h => !h.groupId && !h.isFavorite)

  const groupedHosts = groups.reduce((acc, g) => {
    acc[g.id] = displayed.filter(h => h.groupId === g.id)
    return acc
  }, {} as Record<string, SSHHost[]>)

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const connectHost = async (host: SSHHost) => {
    if (!session) return
    setSelectedHost(host.id)
    const sessionId = uuidv4()
    addTab({
      sessionId,
      title: host.name,
      type: 'ssh',
      hostId: host.id,
      hostname: host.hostname,
      isLocal: false,
      status: 'connecting'
    })
    useUIStore.getState().setView('terminal')
  }

  const openLocalShell = () => {
    const sessionId = uuidv4()
    addTab({ sessionId, title: 'Local Shell', type: 'local', isLocal: true, status: 'connecting' })
    useUIStore.getState().setView('terminal')
  }

  const initials = session?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || 'AS'
  const roleLabel = { super_admin: 'Super Admin', admin: 'Admin', standard: 'User', readonly: 'Read-only' }[session?.role || 'standard']

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        {!sidebarCollapsed && (
          <div className="sidebar-logo">
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="url(#gs)"/>
              <path d="M9 27l7-12 7 12M18 23h7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M25 13l6 6-6 6" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs><linearGradient id="gs" x1="0" y1="0" x2="40" y2="40"><stop stopColor="#1E2A44"/><stop offset="1" stopColor="#0A0E1A"/></linearGradient></defs>
            </svg>
            <span className="sidebar-logo-text">ActionShell</span>
          </div>
        )}
        <button className="btn btn-icon" onClick={toggleSidebar} title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {!sidebarCollapsed && (
        <>
          {/* Search */}
          <div className="sidebar-search">
            <div className="search-input-wrap">
              <Search size={13} />
              <input className="form-input" placeholder="Search hosts…" value={searchQuery}
                onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Nav */}
          <div className="sidebar-nav">
            <div className="nav-item" onClick={openLocalShell}>
              <Terminal size={15} />
              <span>Local Shell</span>
            </div>
            <div className="nav-item" onClick={() => setShowConnectionForm(true)}>
              <Plus size={15} />
              <span>New Connection</span>
            </div>
          </div>

          {/* Host list */}
          <div className="scrollable" style={{flex:1}}>
            {/* Favorites */}
            {favorites.length > 0 && (
              <HostGroup
                label="⭐ Favorites"
                groupId="__favorites__"
                hosts={favorites}
                expanded={expandedGroups.has('__favorites__')}
                onToggle={() => toggleGroup('__favorites__')}
                onConnect={connectHost}
                selectedId={selectedHostId}
              />
            )}

            {/* Groups */}
            {groups.map(g => (
              <HostGroup
                key={g.id}
                label={g.name}
                groupId={g.id}
                hosts={groupedHosts[g.id] || []}
                expanded={expandedGroups.has(g.id)}
                onToggle={() => toggleGroup(g.id)}
                onConnect={connectHost}
                selectedId={selectedHostId}
                color={g.color}
              />
            ))}

            {/* Ungrouped */}
            {ungrouped.length > 0 && (
              <HostGroup
                label="All Servers"
                groupId="__ungrouped__"
                hosts={ungrouped}
                expanded={expandedGroups.has('__ungrouped__')}
                onToggle={() => toggleGroup('__ungrouped__')}
                onConnect={connectHost}
                selectedId={selectedHostId}
              />
            )}

            {displayed.length === 0 && (
              <div className="empty-state" style={{padding:'32px 16px'}}>
                <Server size={32} className="empty-state-icon" />
                <p className="empty-state-title">{searchQuery ? 'No results' : 'No servers'}</p>
                <p className="empty-state-desc">{searchQuery ? 'Try a different search' : 'Add your first SSH host to get started'}</p>
                {!searchQuery && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowConnectionForm(true)}>
                    <Plus size={12}/> Add Server
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sidebar-footer">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{session?.name}</div>
              <div className="user-role">{roleLabel}</div>
            </div>
            <button className="btn btn-icon" onClick={() => useAuthStore.getState().logout()} title="Logout">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Collapsed mode — icon only */}
      {sidebarCollapsed && (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',padding:'8px 0',flex:1}}>
          <button className="btn btn-icon tooltip-anchor" onClick={openLocalShell} title="Local Shell">
            <Terminal size={16}/>
            <span className="tooltip" style={{left:'calc(100% + 8px)',top:'50%',transform:'translateY(-50%)',bottom:'auto'}}>Local Shell</span>
          </button>
          <button className="btn btn-icon" onClick={() => setShowConnectionForm(true)} title="New Connection">
            <Plus size={16}/>
          </button>
          <div className="divider" style={{width:'80%'}}/>
          {displayed.slice(0,8).map(h => (
            <button key={h.id} className={`btn btn-icon tooltip-anchor ${selectedHostId===h.id?'active':''}`}
              onClick={() => connectHost(h)} title={h.name}>
              <Server size={14}/>
              <span className="tooltip" style={{left:'calc(100% + 8px)',top:'50%',transform:'translateY(-50%)',bottom:'auto'}}>{h.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface HostGroupProps {
  label: string; groupId: string; hosts: SSHHost[];
  expanded: boolean; onToggle: () => void; onConnect: (h:SSHHost)=>void;
  selectedId: string|null; color?: string|null;
}

function HostGroup({ label, groupId, hosts, expanded, onToggle, onConnect, selectedId, color }: HostGroupProps) {
  return (
    <div className="sidebar-group">
      <div className="sidebar-group-header" onClick={onToggle}>
        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
          {color && <div style={{width:'6px',height:'6px',borderRadius:'50%',background:color,flexShrink:0}}/>}
          <span>{label}</span>
          <span style={{color:'var(--color-text-700)',fontWeight:400}}>({hosts.length})</span>
        </div>
        {expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
      </div>
      {expanded && hosts.map(h => (
        <HostCard key={h.id} host={h} selected={selectedId===h.id} onConnect={onConnect} />
      ))}
    </div>
  )
}

function HostCard({ host, selected, onConnect }: { host: SSHHost; selected: boolean; onConnect:(h:SSHHost)=>void }) {
  const { setShowConnectionForm } = useUIStore()
  return (
    <div className={`host-card ${selected?'active':''}`} onClick={() => onConnect(host)}>
      <div className={`status-dot ${host.status || 'disconnected'}`} />
      <div className="host-card-info">
        <div className="host-card-name">{host.name}</div>
        <div className="host-card-meta">{host.username ? `${host.username}@` : ''}{host.hostname}:{host.port}</div>
      </div>
      <div className="host-card-actions">
        <button className="btn btn-icon" style={{width:'20px',height:'20px',padding:'2px'}}
          onClick={e => { e.stopPropagation(); setShowConnectionForm(true, host.id) }} title="Edit">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
