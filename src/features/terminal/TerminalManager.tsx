import { Plus, X, Terminal, Server, FolderOpen, Zap, SplitSquareHorizontal, Radio } from 'lucide-react'
import { useTerminalStore } from '../../store/terminal.store'
import { useUIStore } from '../../store/ui.store'
import { useAuthStore } from '../../store/auth.store'
import TerminalPane from './TerminalPane'
import SFTPPanel from '../sftp/SFTPPanel'
import { v4 as uuidv4 } from 'uuid'
import './Terminal.css'

export default function TerminalManager() {
  const { tabs, activeTabId, setActiveTab, removeTab, toggleSftp, addTab, broadcastActive, setBroadcastActive } = useTerminalStore()
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

  return (
    <div className="terminal-manager">
      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map(tab => (
          <div key={tab.id} className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            <div className={`status-dot ${tab.status}`} style={{width:'6px',height:'6px'}}/>
            {tab.isLocal ? <Terminal size={12}/> : <Server size={12}/>}
            <span style={{maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis'}}>{tab.title}</span>
            <button className="tab-close btn btn-icon" style={{width:'16px',height:'16px',padding:'1px'}}
              onClick={e => { e.stopPropagation(); closeTab(tab.id) }}>
              <X size={10}/>
            </button>
          </div>
        ))}
        <button className="tab-add" onClick={newLocalTab} title="New local shell tab">
          <Plus size={14}/>
        </button>
      </div>

      {/* Terminal toolbar */}
      {activeTab && (
        <div className="terminal-toolbar">
          <div style={{display:'flex',alignItems:'center',gap:'6px',flex:1}}>
            <span style={{fontSize:'var(--text-xs)',color:'var(--color-text-600)',fontFamily:'var(--font-mono)'}}>
              {activeTab.isLocal ? '~' : `${activeTab.hostname}`}
            </span>
            <span className={`badge ${activeTab.status==='connected'?'badge-green':activeTab.status==='error'?'badge-red':'badge-amber'}`}>
              {activeTab.status}
            </span>
          </div>
          <div style={{display:'flex',gap:'4px'}}>
            <button className={`btn btn-icon btn-sm ${broadcastActive?'active':''}`}
              style={broadcastActive?{background:'var(--color-accent-glow)',color:'var(--color-accent-500)'}:{}}
              onClick={() => setBroadcastActive(!broadcastActive)} title={broadcastActive?'Disable Keystroke Broadcasting':'Enable Keystroke Broadcasting (Cluster Shell)'}>
              <Radio size={13}/>
            </button>
            <button className="btn btn-icon btn-sm" onClick={() => setShowSnippetPalette(true)} title="Snippets (Ctrl+Shift+P)">
              <Zap size={13}/>
            </button>
            {!activeTab.isLocal && (
              <button className={`btn btn-icon btn-sm ${activeTab.showSftp?'active':''}`}
                style={activeTab.showSftp?{background:'var(--color-accent-glow)',color:'var(--color-accent-500)'}:{}}
                onClick={() => toggleSftp(activeTab.id)} title="Toggle SFTP">
                <FolderOpen size={13}/>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="terminal-content">
        <div className={`terminal-area ${activeTab?.showSftp ? 'with-sftp' : ''}`}>
          {tabs.map(tab => (
            <TerminalPane key={`${tab.id}-${tab.sessionId}`} tab={tab} active={tab.id === activeTabId} />
          ))}
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
          <svg width="56" height="56" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="url(#ge)"/>
            <path d="M9 27l7-12 7 12M18 23h7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M25 13l6 6-6 6" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs><linearGradient id="ge" x1="0" y1="0" x2="40" y2="40"><stop stopColor="#1E2A44"/><stop offset="1" stopColor="#0A0E1A"/></linearGradient></defs>
          </svg>
        </div>
        <h2>ActionShell</h2>
        <p>Select a server from the sidebar to connect, or open a local shell</p>
        <div style={{display:'flex',gap:'12px',marginTop:'8px'}}>
          <button className="btn btn-ghost" onClick={openLocal}><Terminal size={14}/>Local Shell</button>
          <button className="btn btn-primary" onClick={() => setShowConnectionForm(true)}><Plus size={14}/>New Connection</button>
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
