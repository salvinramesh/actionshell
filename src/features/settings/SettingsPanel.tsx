import { useState } from 'react'
import { useUIStore } from '../../store/ui.store'
import { useAuthStore } from '../../store/auth.store'
import { Moon, Sun, Monitor, Terminal, Shield, Bell, Key, Lock } from 'lucide-react'

export default function SettingsPanel() {
  const { theme, setTheme } = useUIStore()
  const { session, logout } = useAuthStore()
  const [tab, setTab] = useState<'appearance'|'terminal'|'security'|'snippets'>('appearance')
  const [termFontSize, setTermFontSize] = useState(13)
  const [termFont, setTermFont] = useState("'JetBrains Mono', monospace")
  const [autoLock, setAutoLock] = useState(30)

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: <Monitor size={15}/> },
    { id: 'terminal', label: 'Terminal', icon: <Terminal size={15}/> },
    { id: 'security', label: 'Security', icon: <Shield size={15}/> },
    { id: 'snippets', label: 'Snippets', icon: <Key size={15}/> },
  ]

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        <div className="admin-sidebar-header"><Monitor size={16} style={{color:'var(--color-accent-500)'}}/>Settings</div>
        {tabs.map(t => (
          <button key={t.id} className={`admin-nav-item ${tab===t.id?'active':''}`} onClick={() => setTab(t.id as any)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="admin-content scrollable" style={{padding:'32px'}}>
        {tab === 'appearance' && (
          <div className="animate-fadeIn" style={{maxWidth:'480px'}}>
            <h2 style={{fontSize:'var(--text-xl)',fontWeight:'var(--weight-bold)',color:'var(--color-text-100)',marginBottom:'24px'}}>Appearance</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
              <div className="form-group">
                <label className="form-label">Theme</label>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginTop:'8px'}}>
                  {[
                    { id:'dark', label:'Dark', icon:<Moon size={20}/> },
                    { id:'light', label:'Light', icon:<Sun size={20}/> },
                    { id:'system', label:'System', icon:<Monitor size={20}/> },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTheme(t.id as any)}
                      style={{padding:'16px 12px',borderRadius:'var(--radius-lg)',border:`2px solid ${theme===t.id?'var(--color-accent-500)':'var(--color-border-default)'}`,background:theme===t.id?'var(--color-accent-glow)':'var(--color-base-750)',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',cursor:'pointer',color:theme===t.id?'var(--color-accent-500)':'var(--color-text-400)',transition:'all 150ms'}}>
                      {t.icon}
                      <span style={{fontSize:'var(--text-sm)',fontWeight:'var(--weight-medium)'}}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'terminal' && (
          <div className="animate-fadeIn" style={{maxWidth:'480px'}}>
            <h2 style={{fontSize:'var(--text-xl)',fontWeight:'var(--weight-bold)',color:'var(--color-text-100)',marginBottom:'24px'}}>Terminal</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
              <div className="form-group">
                <label className="form-label">Font Size</label>
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <input type="range" min={10} max={20} value={termFontSize} onChange={e=>setTermFontSize(+e.target.value)} style={{flex:1}}/>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-sm)',color:'var(--color-text-300)',minWidth:'30px'}}>{termFontSize}px</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Font Family</label>
                <select className="form-input form-select" value={termFont} onChange={e=>setTermFont(e.target.value)}>
                  <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                  <option value="'Fira Code', monospace">Fira Code</option>
                  <option value="'Cascadia Code', monospace">Cascadia Code</option>
                  <option value="Consolas, monospace">Consolas</option>
                  <option value="monospace">System Monospace</option>
                </select>
              </div>
              <div style={{background:'#0A0E1A',border:'1px solid var(--color-border-subtle)',borderRadius:'var(--radius-lg)',padding:'16px',fontFamily:termFont,fontSize:`${termFontSize}px`,color:'#CDD6F4'}}>
                <span style={{color:'#A6E3A1'}}>user@server</span><span style={{color:'#CDD6F4'}}>:</span><span style={{color:'#89B4FA'}}>~/projects</span><span style={{color:'#00D4FF'}}> $ </span><span>ls -la</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="animate-fadeIn" style={{maxWidth:'480px'}}>
            <h2 style={{fontSize:'var(--text-xl)',fontWeight:'var(--weight-bold)',color:'var(--color-text-100)',marginBottom:'24px'}}>Security</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
              <div className="form-group">
                <label className="form-label">Auto-Lock Timeout</label>
                <select className="form-input form-select" value={autoLock} onChange={e=>setAutoLock(+e.target.value)}>
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={0}>Never</option>
                </select>
              </div>
              <div style={{background:'var(--color-base-750)',border:'1px solid var(--color-border-subtle)',borderRadius:'var(--radius-lg)',padding:'16px',fontSize:'var(--text-sm)',color:'var(--color-text-500)'}}>
                <Lock size={14} style={{color:'var(--color-accent-500)',marginBottom:'8px'}}/><br/>
                All credentials are encrypted with <strong style={{color:'var(--color-text-300)'}}>AES-256-GCM</strong> using a key stored in your OS keychain.
                SSH private keys and passwords are never stored in plaintext.
              </div>
              <button className="btn btn-danger btn-sm" style={{alignSelf:'flex-start'}} onClick={() => logout()}>
                Sign Out
              </button>
            </div>
          </div>
        )}

        {tab === 'snippets' && <SnippetManager />}
      </div>
    </div>
  )
}

function SnippetManager() {
  const { session } = useAuthStore()
  const { addNotification } = useUIStore()
  const [snippets, setSnippets] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', command:'', description:'', tags:'' })

  const load = () => {
    if (session) window.actionshell.snippets.list(session.userId, session.role).then(r => { if(r.success) setSnippets(r.data as any[]) })
  }

  useState(() => { load() })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    await window.actionshell.snippets.create({
      title: form.title, command: form.command, description: form.description,
      tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean),
      scope: 'personal'
    }, session.userId)
    addNotification({ type:'success', title:'Snippet saved' })
    setShowForm(false); setForm({ title:'', command:'', description:'', tags:'' }); load()
  }

  const del = async (id: string) => {
    if (!session) return
    await window.actionshell.snippets.delete(id, session.userId)
    load()
  }

  return (
    <div className="animate-fadeIn" style={{maxWidth:'600px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
        <h2 style={{fontSize:'var(--text-xl)',fontWeight:'var(--weight-bold)',color:'var(--color-text-100)'}}>Snippets</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>+ Add Snippet</button>
      </div>

      {showForm && (
        <form onSubmit={save} style={{background:'var(--color-base-750)',border:'1px solid var(--color-border-default)',borderRadius:'var(--radius-lg)',padding:'20px',marginBottom:'20px',display:'flex',flexDirection:'column',gap:'14px'}}>
          <div className="form-group"><label className="form-label">Title *</label><input className="form-input" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Command *</label><textarea className="form-input form-textarea" required style={{fontFamily:'var(--font-mono)',fontSize:'12px'}} value={form.command} onChange={e=>setForm(f=>({...f,command:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Tags (comma separated)</label><input className="form-input" value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))}/></div>
          <div style={{display:'flex',gap:'8px'}}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Save Snippet</button>
          </div>
        </form>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {snippets.map(s => (
          <div key={s.id} style={{background:'var(--color-base-750)',border:'1px solid var(--color-border-subtle)',borderRadius:'var(--radius-lg)',padding:'14px 16px',display:'flex',alignItems:'flex-start',gap:'12px'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:'var(--weight-semibold)',color:'var(--color-text-200)',fontSize:'var(--text-sm)'}}>{s.title}</div>
              <code style={{display:'block',fontSize:'11px',color:'var(--color-accent-400)',fontFamily:'var(--font-mono)',background:'var(--color-base-800)',padding:'4px 8px',borderRadius:'var(--radius-sm)',marginTop:'6px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.command}</code>
            </div>
            <button className="btn btn-icon btn-sm" style={{color:'var(--color-danger-500)',flexShrink:0}} onClick={() => del(s.id)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        ))}
        {snippets.length === 0 && !showForm && (
          <div className="empty-state" style={{padding:'40px'}}><Key size={28} className="empty-state-icon"/><p className="empty-state-title">No snippets yet</p><p className="empty-state-desc">Save reusable commands for one-click execution</p></div>
        )}
      </div>
    </div>
  )
}
