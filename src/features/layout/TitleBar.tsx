import { useState } from 'react'
import { Minus, Maximize2, X, Terminal, Settings, LayoutDashboard, Lock, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useUIStore } from '../../store/ui.store'
import './Layout.css'

export default function TitleBar() {
  const { session, setLocked } = useAuthStore()
  const { theme, setTheme, setView, currentView } = useUIStore()
  const isAdmin = session?.role === 'super_admin' || session?.role === 'admin'

  return (
    <div className="titlebar titlebar">
      <div className="titlebar-left" style={{WebkitAppRegion:'drag'} as any}>
        <div className="win-controls" style={{WebkitAppRegion:'no-drag'} as any}>
          <button className="titlebar-btn close" onClick={() => window.actionshell.window.close()} title="Close">
            <X size={11} />
          </button>
          <button className="titlebar-btn" onClick={() => window.actionshell.window.minimize()} title="Minimize">
            <Minus size={11} />
          </button>
          <button className="titlebar-btn" onClick={() => window.actionshell.window.maximize()} title="Maximize">
            <Maximize2 size={11} />
          </button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'6px',opacity:0.6}}>
          <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
            <path d="M8 28l8-14 8 14M18 24h8" stroke="#00D4FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M26 14l6 6-6 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontSize:'var(--text-xs)',fontWeight:700,color:'var(--color-text-400)',letterSpacing:'-0.01em'}}>ActionShell</span>
        </div>
      </div>

      <div className="titlebar-right" style={{WebkitAppRegion:'no-drag'} as any}>
        <button className={`titlebar-btn ${currentView==='terminal'?'active':''}`}
          style={currentView==='terminal'?{background:'var(--color-accent-glow)',color:'var(--color-accent-500)'}:{}}
          onClick={() => setView('terminal')} title="Terminal">
          <Terminal size={14} />
        </button>
        {isAdmin && (
          <button className={`titlebar-btn`}
            style={currentView==='admin'?{background:'var(--color-accent-glow)',color:'var(--color-accent-500)'}:{}}
            onClick={() => setView('admin')} title="Admin Dashboard">
            <LayoutDashboard size={14} />
          </button>
        )}
        <button className="titlebar-btn" onClick={() => setView('settings')} title="Settings">
          <Settings size={14} />
        </button>
        <button className="titlebar-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button className="titlebar-btn" onClick={() => setLocked(true)} title="Lock session">
          <Lock size={14} />
        </button>
        {session && (
          <div className="user-avatar" style={{width:'22px',height:'22px',fontSize:'9px'}}>
            {session.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
          </div>
        )}
      </div>
    </div>
  )
}
