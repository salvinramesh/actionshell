import { useState, useEffect, useRef } from 'react'
import { Plus, X, Terminal, Server, FolderOpen, Zap, Radio, Grid, Columns, Rows, Square, Copy, ExternalLink, Pencil, Search, Star } from 'lucide-react'
import { useTerminalStore, TerminalTab } from '../../store/terminal.store'
import { useConnectionsStore } from '../../store/connections.store'
import { useUIStore } from '../../store/ui.store'
import { useAuthStore } from '../../store/auth.store'
import TerminalPane from './TerminalPane'
import SFTPPanel from '../sftp/SFTPPanel'
import { v4 as uuidv4 } from 'uuid'
import type { SSHHost } from '../../../shared/types'
import './Terminal.css'
// @ts-ignore
import logo from '../../logo.png'

export default function TerminalManager() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    removeTab,
    toggleSftp,
    addTab,
    updateTab,
    broadcastActive,
    setBroadcastActive,
    layout,
    panes,
    activePaneIndex,
    setLayout,
    setActivePane
  } = useTerminalStore()
  const { hosts } = useConnectionsStore()
  const { setShowSnippetPalette } = useUIStore()
  const { session } = useAuthStore()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addMenuPos, setAddMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [addMenuSearch, setAddMenuSearch] = useState('')
  const [renamingTab, setRenamingTab] = useState<{ id: string; title: string } | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      setContextMenu(null)
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  const handleAddClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (showAddMenu) {
      setShowAddMenu(false)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      const left = Math.max(10, Math.min(rect.left, window.innerWidth - 335))
      setAddMenuPos({ top: rect.bottom + 6, left })
      setShowAddMenu(true)
    }
  }

  const closeTab = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (tab && tab.status !== 'closed') {
      await window.actionshell.terminal.close(tab.sessionId, tab.isLocal || false, session?.userId)
    }
    removeTab(tabId)
  }

  const newLocalTab = () => {
    const sessionId = uuidv4()
    addTab({ sessionId, title: 'Local Shell', type: 'local', isLocal: true, status: 'connecting' })
  }

  const duplicateTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return
    const newSessionId = uuidv4()
    addTab({
      sessionId: newSessionId,
      title: tab.title,
      type: tab.type,
      hostId: tab.hostId,
      hostname: tab.hostname,
      isLocal: tab.isLocal,
      status: 'connecting'
    })
    setContextMenu(null)
  }

  const connectHostFromMenu = (host: SSHHost) => {
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
    setShowAddMenu(false)
    setAddMenuSearch('')
  }

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (renamingTab && renamingTab.title.trim()) {
      updateTab(renamingTab.id, { title: renamingTab.title.trim() })
    }
    setRenamingTab(null)
  }

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, tabId })
  }

  const filteredMenuHosts = hosts.filter(h => {
    if (!addMenuSearch) return true
    const q = addMenuSearch.toLowerCase()
    return h.name.toLowerCase().includes(q) || h.hostname.toLowerCase().includes(q) || (h.username || '').toLowerCase().includes(q)
  })

  const activeTab = tabs.find(t => t.id === activeTabId)

  if (tabs.length === 0) {
    return <TerminalEmptyState />
  }

  const maxVisiblePanes = layout === 'single' ? 1 : layout === 'grid' ? 4 : 2

  return (
    <div className="terminal-manager">
      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
            draggable={true}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', tab.id)
            }}
          >
            <div className={`status-dot ${tab.status}`} style={{ width: '6px', height: '6px' }} />
            {tab.isLocal ? <Terminal size={12} /> : <Server size={12} />}
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.title}</span>
            <button
              className="tab-close btn btn-icon"
              style={{ width: '16px', height: '16px', padding: '1px' }}
              onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <div style={{ position: 'relative' }} ref={addMenuRef}>
          <button className="tab-add" onClick={handleAddClick} title="New Tab Options">
            <Plus size={14} />
          </button>

          {showAddMenu && addMenuPos && (
            <div
              className="tab-add-popover-fixed animate-fadeInScale"
              style={{ top: `${addMenuPos.top}px`, left: `${addMenuPos.left}px` }}
              onClick={e => e.stopPropagation()}
            >
              <button className="tab-add-popover-item" onClick={() => { newLocalTab(); setShowAddMenu(false) }}>
                <Terminal size={14} style={{ color: 'var(--color-accent-500)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Connect Local Shell</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-500)', fontWeight: 'normal' }}>Open local Zsh / PowerShell</span>
                </div>
              </button>

              <div className="tab-add-divider" />

              <div className="tab-add-search-wrap">
                <Search size={12} style={{ color: 'var(--color-text-500)', flexShrink: 0 }} />
                <input
                  className="tab-add-search-input"
                  type="text"
                  placeholder="Search remote servers..."
                  autoFocus
                  value={addMenuSearch}
                  onChange={e => setAddMenuSearch(e.target.value)}
                />
                {addMenuSearch && (
                  <button className="btn btn-icon" style={{ padding: '2px' }} onClick={() => setAddMenuSearch('')}>
                    <X size={10} />
                  </button>
                )}
              </div>

              <div className="tab-add-host-list scrollable">
                {filteredMenuHosts.length === 0 ? (
                  <div className="tab-add-empty-state">
                    No remote servers found
                  </div>
                ) : (
                  filteredMenuHosts.map(h => (
                    <div key={h.id} className="tab-add-host-item" onClick={() => connectHostFromMenu(h)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <Server size={12} style={{ color: 'var(--color-accent-400)', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span className="host-item-title">{h.name}</span>
                          <span className="host-item-sub">
                            {h.username || 'root'}@{h.hostname}:{h.port || 22}
                          </span>
                        </div>
                      </div>
                      {h.isFavorite && <Star size={10} style={{ color: '#F9E2AF', fill: '#F9E2AF', flexShrink: 0 }} />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Context Menu Overlay */}
      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={e => e.stopPropagation()}
        >
          <button className="tab-context-menu-item" onClick={() => duplicateTab(contextMenu.tabId)}>
            <Copy size={13} /> Duplicate
          </button>
          <button className="tab-context-menu-item" onClick={() => duplicateTab(contextMenu.tabId)}>
            <ExternalLink size={13} /> Duplicate in a new window
          </button>
          <button className="tab-context-menu-item" onClick={() => { setBroadcastActive(!broadcastActive); setContextMenu(null) }}>
            <Radio size={13} /> {broadcastActive ? 'Stop multiplayer' : 'Start multiplayer'}
          </button>
          <div className="tab-context-menu-divider" />
          <button className="tab-context-menu-item" onClick={() => {
            const t = tabs.find(x => x.id === contextMenu.tabId)
            if (t) setRenamingTab({ id: t.id, title: t.title })
            setContextMenu(null)
          }}>
            <Pencil size={13} /> Rename
          </button>
          <button className="tab-context-menu-item" onClick={() => { setLayout('split-h'); setContextMenu(null) }}>
            <Rows size={13} /> Split horizontally
          </button>
          <button className="tab-context-menu-item" onClick={() => { setLayout('split-v'); setContextMenu(null) }}>
            <Columns size={13} /> Split vertically
          </button>
          <div className="tab-context-menu-divider" />
          <button className="tab-context-menu-item danger" onClick={() => { closeTab(contextMenu.tabId); setContextMenu(null) }}>
            <X size={13} /> Close
          </button>
        </div>
      )}

      {/* Rename Tab Modal */}
      {renamingTab && (
        <div className="modal-backdrop animate-fadeIn" onClick={() => setRenamingTab(null)}>
          <div className="modal-card" style={{ maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Rename Tab</span>
              <button className="btn btn-icon btn-sm" onClick={() => setRenamingTab(null)}><X size={12} /></button>
            </div>
            <form onSubmit={handleRenameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              <input
                className="form-input"
                type="text"
                autoFocus
                value={renamingTab.title}
                onChange={e => setRenamingTab({ ...renamingTab, title: e.target.value })}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenamingTab(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Title</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminal toolbar */}
      {activeTab && (
        <div className="terminal-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-600)', fontFamily: 'var(--font-mono)' }}>
              {activeTab.isLocal ? '~' : `${activeTab.hostname}`}
            </span>
            <span className={`badge ${activeTab.status === 'connected' ? 'badge-green' : activeTab.status === 'error' ? 'badge-red' : 'badge-amber'}`}>
              {activeTab.status}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {/* Layout Controls */}
            <button
              className={`btn btn-icon btn-sm ${layout === 'single' ? 'active' : ''}`}
              style={layout === 'single' ? { background: 'var(--color-accent-glow)', color: 'var(--color-accent-500)' } : {}}
              onClick={() => setLayout('single')}
              title="Single Pane View"
            >
              <Square size={13} />
            </button>
            <button
              className={`btn btn-icon btn-sm ${layout === 'split-v' ? 'active' : ''}`}
              style={layout === 'split-v' ? { background: 'var(--color-accent-glow)', color: 'var(--color-accent-500)' } : {}}
              onClick={() => setLayout('split-v')}
              title="Split Vertically"
            >
              <Columns size={13} />
            </button>
            <button
              className={`btn btn-icon btn-sm ${layout === 'split-h' ? 'active' : ''}`}
              style={layout === 'split-h' ? { background: 'var(--color-accent-glow)', color: 'var(--color-accent-500)' } : {}}
              onClick={() => setLayout('split-h')}
              title="Split Horizontally"
            >
              <Rows size={13} />
            </button>
            <button
              className={`btn btn-icon btn-sm ${layout === 'grid' ? 'active' : ''}`}
              style={layout === 'grid' ? { background: 'var(--color-accent-glow)', color: 'var(--color-accent-500)' } : {}}
              onClick={() => setLayout('grid')}
              title="2x2 Grid View"
            >
              <Grid size={13} />
            </button>

            <span style={{ width: '1px', height: '16px', background: 'var(--color-border-subtle)', alignSelf: 'center', margin: '0 4px' }} />

            <button
              className={`btn btn-icon btn-sm ${broadcastActive ? 'active' : ''}`}
              style={broadcastActive ? { background: 'var(--color-accent-glow)', color: 'var(--color-accent-500)' } : {}}
              onClick={() => setBroadcastActive(!broadcastActive)}
              title={broadcastActive ? 'Disable Keystroke Broadcasting' : 'Enable Keystroke Broadcasting (Cluster Shell)'}
            >
              <Radio size={13} />
            </button>
            <button className="btn btn-icon btn-sm" onClick={() => setShowSnippetPalette(true)} title="Snippets (Ctrl+Shift+P)">
              <Zap size={13} />
            </button>
            {!activeTab.isLocal && (
              <button
                className={`btn btn-icon btn-sm ${activeTab.showSftp ? 'active' : ''}`}
                style={activeTab.showSftp ? { background: 'var(--color-accent-glow)', color: 'var(--color-accent-500)' } : {}}
                onClick={() => toggleSftp(activeTab.id)}
                title="Toggle SFTP"
              >
                <FolderOpen size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="terminal-content">
        <div className={`terminal-area ${activeTab?.showSftp ? 'with-sftp' : ''}`}>
          <div className={`terminal-panes-container layout-${layout}`}>
            {/* Render wrappers for active tabs inside panes */}
            {tabs.map(tab => {
              const paneIdx = panes.indexOf(tab.id)
              const isVisible = paneIdx !== -1 && paneIdx < maxVisiblePanes
              const isActive = isVisible && activePaneIndex === paneIdx

              return (
                <PaneWrapper
                  key={tab.id}
                  tab={tab}
                  paneIdx={paneIdx}
                  isVisible={isVisible}
                  isActive={isActive}
                />
              )
            })}

            {/* Render placeholders for empty panes */}
            {Array.from({ length: maxVisiblePanes }).map((_, idx) => {
              if (panes[idx] === null) {
                return (
                  <EmptyPanePlaceholder
                    key={`empty-${idx}`}
                    paneIdx={idx}
                    isActive={activePaneIndex === idx}
                  />
                )
              }
              return null
            })}
          </div>
        </div>
        {activeTab?.showSftp && activeTab.hostId && (
          <div className="sftp-area">
            <SFTPPanel hostId={activeTab.hostId} sessionId={activeTab.sessionId + '-sftp'} />
          </div>
        )}
      </div>
    </div>
  )
}

interface PaneWrapperProps {
  tab: TerminalTab
  paneIdx: number
  isVisible: boolean
  isActive: boolean
}

function PaneWrapper({ tab, paneIdx, isVisible, isActive }: PaneWrapperProps) {
  const { setActivePane, splitPane } = useTerminalStore()
  const [dragOverZone, setDragOverZone] = useState<'left' | 'right' | 'top' | 'bottom' | 'center' | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const w = rect.width
    const h = rect.height

    let zone: 'left' | 'right' | 'top' | 'bottom' | 'center' = 'center'
    if (x < w * 0.25) zone = 'left'
    else if (x > w * 0.75) zone = 'right'
    else if (y < h * 0.25) zone = 'top'
    else if (y > h * 0.75) zone = 'bottom'

    setDragOverZone(zone)
  }

  const handleDragLeave = () => {
    setDragOverZone(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const sourceTabId = e.dataTransfer.getData('text/plain')
    if (sourceTabId && sourceTabId !== tab.id) {
      splitPane(sourceTabId, paneIdx, dragOverZone || 'center')
    }
    setDragOverZone(null)
  }

  return (
    <div
      className={`terminal-pane-wrapper ${isActive ? 'active' : ''} ${isVisible ? 'visible' : 'hidden'}`}
      style={{
        gridArea: isVisible ? `pane${paneIdx}` : undefined,
        display: isVisible ? 'block' : 'none'
      }}
      onClickCapture={() => {
        if (isVisible && !isActive) {
          setActivePane(paneIdx)
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TerminalPane tab={tab} active={isActive} isVisible={isVisible} />
      {dragOverZone && (
        <div className={`drag-drop-overlay zone-${dragOverZone}`} />
      )}
    </div>
  )
}

interface EmptyPaneProps {
  paneIdx: number
  isActive: boolean
}

function EmptyPanePlaceholder({ paneIdx, isActive }: EmptyPaneProps) {
  const { setActivePane, setPaneTab, tabs, panes, addTab, splitPane } = useTerminalStore()
  const [dragOverZone, setDragOverZone] = useState<'center' | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverZone('center')
  }

  const handleDragLeave = () => {
    setDragOverZone(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const sourceTabId = e.dataTransfer.getData('text/plain')
    if (sourceTabId) {
      splitPane(sourceTabId, paneIdx, 'center')
    }
    setDragOverZone(null)
  }

  const spawnLocal = () => {
    const sessionId = uuidv4()
    const newTabId = addTab({ sessionId, title: 'Local Shell', type: 'local', isLocal: true, status: 'connecting' })
    setPaneTab(paneIdx, newTabId)
  }

  const availableTabs = tabs.filter(t => !panes.includes(t.id))

  return (
    <div
      className={`terminal-pane-wrapper ${isActive ? 'active' : ''}`}
      style={{
        gridArea: `pane${paneIdx}`,
        display: 'block'
      }}
      onClickCapture={() => {
        if (!isActive) {
          setActivePane(paneIdx)
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="pane-empty-placeholder">
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Empty Pane</div>
        {availableTabs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '80%', maxWidth: '200px' }}>
            <select
              className="form-input form-select"
              style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }}
              onChange={(e) => {
                if (e.target.value) {
                  setPaneTab(paneIdx, e.target.value)
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Select active tab...</option>
              {availableTabs.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--color-text-700)' }}>or</div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 'var(--text-xs)' }} onClick={spawnLocal}>
              + Local Shell
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 'var(--text-xs)' }} onClick={spawnLocal}>
            + Local Shell
          </button>
        )}
      </div>
      {dragOverZone && (
        <div className="drag-drop-overlay zone-center" />
      )}
    </div>
  )
}

function TerminalEmptyState() {
  const { setShowConnectionForm } = useUIStore()
  const { addTab } = useTerminalStore()

  const openLocal = () => {
    const sessionId = uuidv4()
    addTab({ sessionId, title: 'Local Shell', type: 'local', isLocal: true, status: 'connecting' })
  }

  return (
    <div className="terminal-empty">
      <div className="terminal-empty-inner animate-fadeIn">
        <div className="terminal-empty-logo">
          <img src={logo} alt="ActionShell" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
        </div>
        <h2>ActionShell</h2>
        <p>Select a server from the sidebar to connect, or open a local shell</p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button className="btn btn-ghost" onClick={openLocal}><Terminal size={14} />Local Shell</button>
          <button className="btn btn-primary" onClick={() => setShowConnectionForm(true)}><Plus size={14} />New Connection</button>
        </div>
        <div className="terminal-shortcuts">
          <span><kbd>Ctrl+Shift+P</kbd> Snippets</span>
          <span><kbd>Ctrl+T</kbd> New Tab</span>
          <span><kbd>Ctrl+W</kbd> Close Tab</span>
        </div>
      </div>
    </div>
  )
}
