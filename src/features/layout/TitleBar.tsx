import { useState, useEffect } from 'react'
import { Minus, Maximize2, X, Terminal, Settings, LayoutDashboard, Lock, Moon, Sun, Network, ArrowUpCircle } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useUIStore } from '../../store/ui.store'
import './Layout.css'
// @ts-ignore
import logo from '../../logo.png'

export default function TitleBar() {
  const { session, setLocked } = useAuthStore()
  const { theme, setTheme, setView, currentView } = useUIStore()
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean; latestVersion: string; releaseUrl: string } | null>(null)
  const isAdmin = session?.role === 'super_admin' || session?.role === 'admin'

  useEffect(() => {
    window.actionshell.app.checkUpdate().then((res: any) => {
      if (res && res.hasUpdate) {
        setUpdateInfo(res)
      }
    }).catch(() => {})
  }, [])

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
          <img src={logo} alt="ActionShell" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
          <span style={{fontSize:'var(--text-xs)',fontWeight:700,color:'var(--color-text-400)',letterSpacing:'-0.01em'}}>ActionShell</span>
        </div>

        {updateInfo?.hasUpdate && (
          <button
            className="titlebar-update-pill animate-fadeIn"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            onClick={() => window.actionshell.app.openRelease(updateInfo.releaseUrl)}
            title={`ActionShell v${updateInfo.latestVersion} is available! Click to download.`}
          >
            <ArrowUpCircle size={12} style={{ color: 'var(--color-accent-400)' }} />
            <span>v{updateInfo.latestVersion} Available</span>
          </button>
        )}
      </div>

      <div className="titlebar-right" style={{WebkitAppRegion:'no-drag'} as any}>
        {session && (
          <>
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
            <button className={`titlebar-btn ${currentView==='tunnels'?'active':''}`}
              style={currentView==='tunnels'?{background:'var(--color-accent-glow)',color:'var(--color-accent-500)'}:{}}
              onClick={() => setView('tunnels')} title="Port Forwarding">
              <Network size={14} />
            </button>
            <button className="titlebar-btn" onClick={() => setView('settings')} title="Settings">
              <Settings size={14} />
            </button>
          </>
        )}
        <button className="titlebar-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        {session && (
          <>
            <button className="titlebar-btn" onClick={() => setLocked(true)} title="Lock session">
              <Lock size={14} />
            </button>
            <div className="user-avatar" style={{width:'22px',height:'22px',fontSize:'9px'}}>
              {session.name ? session.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) : 'AS'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
