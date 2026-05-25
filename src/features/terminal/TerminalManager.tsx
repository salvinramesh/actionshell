import { useState } from 'react'
import { Plus, X, Terminal, Server, FolderOpen, Zap, Radio, Grid, Columns, Rows, Square } from 'lucide-react'
import { useTerminalStore, TerminalTab } from '../../store/terminal.store'
import { useUIStore } from '../../store/ui.store'
import { useAuthStore } from '../../store/auth.store'
import TerminalPane from './TerminalPane'
import SFTPPanel from '../sftp/SFTPPanel'
import { v4 as uuidv4 } from 'uuid'
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
    broadcastActive,
    setBroadcastActive,
    layout,
    panes,
    activePaneIndex,
    setLayout,
    setActivePane
  } = useTerminalStore()
  const { setShowSnippetPalette } = useUIStore()
  const { session } = useAuthStore()

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
        <button className="tab-add" onClick={newLocalTab} title="New local shell tab">
          <Plus size={14} />
        </button>
      </div>

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
