import { useState, useEffect } from 'react'
import { useUIStore } from '../../store/ui.store'
import { useAuthStore } from '../../store/auth.store'
import { Moon, Sun, Monitor, Terminal, Shield, Key, Lock, Zap, Info, RefreshCw, ExternalLink, CheckCircle, Sparkles } from 'lucide-react'
import QRCode from 'qrcode'

export default function SettingsPanel() {
  const {
    theme, setTheme,
    termTheme, setTermTheme,
    termFontSize, setTermFontSize,
    termFontFamily, setTermFontFamily,
    termFontColor, setTermFontColor,
    termBgColor, setTermBgColor,
    logHighlightActive, setLogHighlightActive,
    defaultShell, setDefaultShell,
    customShellPath, setCustomShellPath
  } = useUIStore()
  const { session, logout } = useAuthStore()

  const THEME_COLORS: Record<string, { background: string; foreground: string }> = {
    dark: { background: '#0A0E1A', foreground: '#CDD6F4' },
    light: { background: '#F8FAFF', foreground: '#2A3252' },
    nord: { background: '#2e3440', foreground: '#d8dee9' },
    dracula: { background: '#282a36', foreground: '#f8f8f2' },
    solarized: { background: '#002b36', foreground: '#839496' }
  }

  const handleTermThemeChange = (newTheme: string) => {
    setTermTheme(newTheme)
    if (newTheme !== 'custom') {
      const colors = THEME_COLORS[newTheme]
      if (colors) {
        setTermBgColor(colors.background)
        setTermFontColor(colors.foreground)
      }
    }
  }

  const handleCustomBgChange = (color: string) => {
    setTermBgColor(color)
    setTermTheme('custom')
  }

  const handleCustomFontChange = (color: string) => {
    setTermFontColor(color)
    setTermTheme('custom')
  }
  const [tab, setTab] = useState<'appearance'|'terminal'|'keys'|'snippets'|'security'|'about'>('appearance')
  const [autoLock, setAutoLock] = useState(30)
  
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qrUrl: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaSuccess, setMfaSuccess] = useState('')

  const [appVersion, setAppVersion] = useState('1.3.9')
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateCheckStatus, setUpdateCheckStatus] = useState<{ hasUpdate: boolean; latestVersion: string; releaseUrl: string } | null>(null)

  useEffect(() => {
    window.actionshell.app.getVersion().then((v: string) => {
      if (v) setAppVersion(v)
    }).catch(() => {})
  }, [])

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true)
    try {
      const res = await window.actionshell.app.checkUpdate()
      setUpdateCheckStatus(res)
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  useEffect(() => {
    if (tab === 'security') {
      window.actionshell.auth.me().then(res => {
        if (res.success && res.data) {
          const user = (res.data as any).user
          if (user) {
            setMfaEnabled(Boolean(user.mfaEnabled))
          }
        }
      })
    }
  }, [tab])

  const handleSetupMfa = async () => {
    setMfaError('')
    try {
      const res = await window.actionshell.auth.mfaSetup()
      if (res.success && res.data) {
        const qrUrl = await QRCode.toDataURL(res.data.otpauthUrl)
        setMfaSetupData({ secret: res.data.secret, qrUrl })
      } else {
        setMfaError(res.error || 'Failed to initialize setup')
      }
    } catch (err: any) {
      setMfaError(err.message || 'Failed to setup MFA')
    }
  }

  const handleEnableMfa = async () => {
    setMfaError('')
    if (!mfaSetupData || !mfaCode) return
    try {
      const res = await window.actionshell.auth.mfaEnable(mfaSetupData.secret, mfaCode)
      if (res.success) {
        setMfaEnabled(true)
        setMfaSetupData(null)
        setMfaCode('')
        setMfaSuccess('MFA enabled successfully!')
        setTimeout(() => setMfaSuccess(''), 4000)
      } else {
        setMfaError(res.error || 'Invalid verification code')
      }
    } catch (err: any) {
      setMfaError(err.message || 'Failed to enable MFA')
    }
  }

  const handleDisableMfa = async () => {
    if (!confirm('Are you sure you want to disable Multi-Factor Authentication?')) return
    setMfaError('')
    try {
      const res = await window.actionshell.auth.mfaDisable()
      if (res.success) {
        setMfaEnabled(false)
        setMfaSuccess('MFA disabled successfully.')
        setTimeout(() => setMfaSuccess(''), 4000)
      } else {
        setMfaError(res.error || 'Failed to disable MFA')
      }
    } catch (err: any) {
      setMfaError(err.message || 'Failed to disable MFA')
    }
  }

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: <Monitor size={15}/> },
    { id: 'terminal', label: 'Terminal', icon: <Terminal size={15}/> },
    { id: 'keys', label: 'SSH Keys', icon: <Key size={15}/> },
    { id: 'snippets', label: 'Snippets', icon: <Zap size={15}/> },
    { id: 'security', label: 'Security', icon: <Shield size={15}/> },
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
                <label className="form-label">Preferred Local Shell</label>
                <select className="form-input form-select" value={defaultShell} onChange={e=>setDefaultShell(e.target.value)}>
                  <option value="zsh">Zsh (Recommended / Default)</option>
                  <option value="bash">Bash</option>
                  <option value="powershell">PowerShell</option>
                  <option value="custom">Custom Shell Path...</option>
                </select>
              </div>

              {defaultShell === 'custom' && (
                <div className="form-group">
                  <label className="form-label">Custom Shell Executable Path</label>
                  <input
                    className="form-input mono"
                    type="text"
                    placeholder="e.g. /usr/bin/zsh or C:\Program Files\Git\bin\bash.exe"
                    value={customShellPath}
                    onChange={e => setCustomShellPath(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Terminal Theme</label>
                <select className="form-input form-select" value={termTheme} onChange={e=>handleTermThemeChange(e.target.value)}>
                  <option value="dark">Default Dark</option>
                  <option value="nord">Nord Theme</option>
                  <option value="dracula">Dracula Theme</option>
                  <option value="solarized">Solarized Dark</option>
                  <option value="light">Light Theme</option>
                  <option value="custom">Custom Theme</option>
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="form-group">
                  <label className="form-label">Terminal Background Color</label>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginTop:'6px'}}>
                    <input type="color" value={termBgColor} onChange={e=>handleCustomBgChange(e.target.value)} style={{width:'32px',height:'32px',border:'none',padding:0,background:'none',cursor:'pointer',borderRadius:'4px'}}/>
                    <input className="form-input mono" type="text" value={termBgColor} onChange={e=>handleCustomBgChange(e.target.value)} style={{flex:1,fontSize:'var(--text-xs)',height:'32px'}}/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Terminal Font Color</label>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginTop:'6px'}}>
                    <input type="color" value={termFontColor} onChange={e=>handleCustomFontChange(e.target.value)} style={{width:'32px',height:'32px',border:'none',padding:0,background:'none',cursor:'pointer',borderRadius:'4px'}}/>
                    <input className="form-input mono" type="text" value={termFontColor} onChange={e=>handleCustomFontChange(e.target.value)} style={{flex:1,fontSize:'var(--text-xs)',height:'32px'}}/>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Font Size</label>
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <input type="range" min={10} max={20} value={termFontSize} onChange={e=>setTermFontSize(+e.target.value)} style={{flex:1}}/>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-sm)',color:'var(--color-text-300)',minWidth:'30px'}}>{termFontSize}px</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Font Family (Nerd Fonts supported for Zsh Powerline prompts)</label>
                <select className="form-input form-select" value={termFontFamily} onChange={e=>setTermFontFamily(e.target.value)}>
                  <option value="'MesloLGS NF', 'FiraCode Nerd Font', 'JetBrains Mono', monospace">MesloLGS NF / Powerline</option>
                  <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                  <option value="'Fira Code', 'FiraCode Nerd Font', monospace">Fira Code</option>
                  <option value="'Cascadia Code', monospace">Cascadia Code</option>
                  <option value="Consolas, monospace">Consolas</option>
                  <option value="monospace">System Monospace</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',fontSize:'var(--text-sm)',color:'var(--color-text-400)'}}>
                  <input type="checkbox" checked={logHighlightActive} onChange={e=>setLogHighlightActive(e.target.checked)} style={{width:'16px',height:'16px'}}/>
                  Enable Live Log Triggers & Highlighting (ERROR, SUCCESS, IP addresses)
                </label>
              </div>

              {/* Native Command Auto-Suggestions */}
              <div style={{borderTop:'1px solid var(--color-border-subtle)',paddingTop:'20px',marginTop:'4px'}}>
                <h3 style={{fontSize:'var(--text-md)',fontWeight:'var(--weight-semibold)',color:'var(--color-text-200)',marginBottom:'14px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <Zap size={16} style={{color:'var(--color-accent-500)'}}/> Client-Side Command Auto-Suggestions
                </h3>
                <div style={{padding:'12px 14px',background:'var(--color-base-800)',borderRadius:'var(--radius-md)',fontSize:'12px',color:'var(--color-text-400)',lineHeight:1.5}}>
                  ActionShell automatically provides smart inline command autocompletions for all terminal sessions (SSH and Local Shell).
                  Press <kbd style={{background:'var(--color-base-700)',padding:'2px 6px',borderRadius:'4px',fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--color-accent-400)'}}>→</kbd> or <kbd style={{background:'var(--color-base-700)',padding:'2px 6px',borderRadius:'4px',fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--color-accent-400)'}}>Tab</kbd> to accept suggestions.
                </div>
              </div>

              <div style={{background:termBgColor,border:'1px solid var(--color-border-subtle)',borderRadius:'var(--radius-lg)',padding:'16px',fontFamily:termFontFamily,fontSize:`${termFontSize}px`,color:termFontColor}}>
                <span style={{color:'#A6E3A1'}}>user@server</span><span style={{color:termFontColor}}>:</span><span style={{color:'#89B4FA'}}>~/projects</span><span style={{color:'#00D4FF'}}> $ </span><span>ls -la</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'keys' && <SSHKeyManager />}

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

              {/* MFA Setup Block */}
              <div style={{borderTop:'1px solid var(--color-border-subtle)',paddingTop:'20px',marginTop:'10px'}}>
                <h3 style={{fontSize:'var(--text-md)',fontWeight:'var(--weight-semibold)',color:'var(--color-text-200)',marginBottom:'12px'}}>
                  Multi-Factor Authentication (MFA)
                </h3>
                
                {mfaEnabled ? (
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',background:'rgba(46, 160, 67, 0.1)',border:'1px solid rgba(46, 160, 67, 0.2)',padding:'10px 14px',borderRadius:'var(--radius-md)',color:'#7ee787',fontSize:'var(--text-sm)'}}>
                      <Shield size={16}/>
                      <span>MFA is currently active on your account.</span>
                    </div>
                    <button className="btn btn-secondary btn-sm" style={{color:'var(--color-danger-500)',alignSelf:'flex-start'}} onClick={handleDisableMfa}>
                      Disable MFA
                    </button>
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    <p style={{fontSize:'var(--text-sm)',color:'var(--color-text-500)',margin:0,lineHeight:1.4}}>
                      Protect your account with an extra layer of security. When enabled, you must provide a 6-digit TOTP verification code from an authenticator app during login.
                    </p>
                    
                    {!mfaSetupData ? (
                      <button className="btn btn-primary btn-sm" style={{alignSelf:'flex-start'}} onClick={handleSetupMfa}>
                        Set up MFA
                      </button>
                    ) : (
                      <div style={{background:'var(--color-base-750)',border:'1px solid var(--color-border-default)',borderRadius:'var(--radius-lg)',padding:'16px',display:'flex',flexDirection:'column',gap:'16px'}}>
                        <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
                          <div style={{background:'white',padding:'8px',borderRadius:'var(--radius-md)',display:'flex',alignItems:'center',justifyContent:'center',width:'140px',height:'140px',flexShrink:0}}>
                            <img src={mfaSetupData.qrUrl} alt="MFA QR Code" style={{width:'124px',height:'124px'}} />
                          </div>
                          <div style={{flex:1,display:'flex',flexDirection:'column',gap:'8px',fontSize:'var(--text-sm)',color:'var(--color-text-300)'}}>
                            <strong>Step 1: Scan QR Code</strong>
                            <span>Scan the code using your authenticator app. If you cannot scan it, enter the secret code manually:</span>
                            <code style={{background:'var(--color-base-850)',padding:'4px 8px',borderRadius:'var(--radius-sm)',fontSize:'var(--text-xs)',fontFamily:'var(--font-mono)',color:'var(--color-accent-400)'}}>
                              {mfaSetupData.secret}
                            </code>
                          </div>
                        </div>
                        
                        <div style={{borderTop:'1px solid var(--color-border-subtle)',paddingTop:'12px',display:'flex',flexDirection:'column',gap:'10px'}}>
                          <strong>Step 2: Enter Verification Code</strong>
                          <div style={{display:'flex',gap:'10px'}}>
                            <input className="form-input" style={{maxWidth:'180px'}} maxLength={6} placeholder="6-digit code" value={mfaCode} onChange={e => setMfaCode(e.target.value)}/>
                            <button className="btn btn-primary btn-sm" onClick={handleEnableMfa}>Verify & Enable</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setMfaSetupData(null)}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {mfaError && <p className="form-error" style={{marginTop:'8px'}}>{mfaError}</p>}
                {mfaSuccess && <p className="form-success" style={{marginTop:'8px',color:'#A6E3A1',fontSize:'13px'}}>{mfaSuccess}</p>}
              </div>

              <button className="btn btn-danger btn-sm" style={{alignSelf:'flex-start',marginTop:'10px'}} onClick={() => logout()}>
                Sign Out
              </button>
            </div>
          </div>
        )}

        {tab === 'snippets' && <SnippetManager />}

        {tab === 'about' && (
          <div className="animate-fadeIn" style={{ maxWidth: '540px' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-100)', marginBottom: '24px' }}>About & Updates</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'var(--color-base-750)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-100)' }}>ActionShell Enterprise</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-400)', fontFamily: 'var(--font-mono)' }}>Installed Version: v{appVersion || '1.3.9'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', background: 'var(--color-base-750)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-200)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={16} style={{ color: 'var(--color-accent-500)' }} /> Software Updates
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-400)', margin: 0, lineHeight: 1.5 }}>
                  ActionShell automatically checks for new releases on GitHub on startup. You can also manually check for updates below.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    disabled={isCheckingUpdate}
                    onClick={handleManualCheckUpdate}
                  >
                    <RefreshCw size={13} className={isCheckingUpdate ? 'spin' : ''} />
                    {isCheckingUpdate ? 'Checking GitHub...' : 'Check for Updates'}
                  </button>

                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => window.actionshell.app.openRelease('https://github.com/salvinramesh/actionshell/releases')}
                  >
                    <ExternalLink size={13} /> View Releases
                  </button>
                </div>

                {updateCheckStatus && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: updateCheckStatus.hasUpdate ? 'rgba(0, 212, 255, 0.12)' : 'rgba(166, 227, 161, 0.12)', border: `1px solid ${updateCheckStatus.hasUpdate ? 'var(--color-accent-500)' : '#A6E3A1'}`, display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)' }}>
                    {updateCheckStatus.hasUpdate ? (
                      <>
                        <Sparkles size={14} style={{ color: 'var(--color-accent-400)' }} />
                        <span style={{ color: 'var(--color-text-100)' }}>New version <strong>v{updateCheckStatus.latestVersion}</strong> is available!</span>
                        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '11px' }} onClick={() => window.actionshell.app.openRelease(updateCheckStatus.releaseUrl)}>Download Update</button>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} style={{ color: '#A6E3A1' }} />
                        <span style={{ color: '#A6E3A1' }}>ActionShell is up to date (v{appVersion || '1.3.9'}).</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SSHKeyManager() {
  const { addNotification } = useUIStore()
  const [keys, setKeys] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', key: '', passphrase: '' })
  const [loading, setLoading] = useState(false)

  const load = () => {
    window.actionshell.savedKeys.list().then(r => {
      if (r.success) setKeys(r.data as any[])
    })
  }

  useState(() => { load() })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.key) return
    setLoading(true)
    const res = await window.actionshell.savedKeys.add(form.name, form.key, form.passphrase || undefined)
    setLoading(false)
    if (res.success) {
      addNotification({ type: 'success', title: 'SSH key saved', message: form.name })
      setShowForm(false)
      setForm({ name: '', key: '', passphrase: '' })
      load()
    } else {
      alert(res.error || 'Failed to save key')
    }
  }

  const del = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the saved key "${name}"?`)) return
    const res = await window.actionshell.savedKeys.delete(id)
    if (res.success) {
      addNotification({ type: 'success', title: 'SSH key deleted', message: name })
      load()
    }
  }

  return (
    <div className="animate-fadeIn" style={{ maxWidth: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-100)' }}>Saved SSH Keys</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>+ Add SSH Key</button>
      </div>

      {showForm && (
        <form onSubmit={save} style={{ background: 'var(--color-base-750)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Key Name *</label>
            <input className="form-input" required placeholder="e.g. Production Bastion Key" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Private Key Content *</label>
            <textarea className="form-input form-textarea" required rows={6} placeholder="Paste your private key here (-----BEGIN ... KEY-----)" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Key Passphrase (optional)</label>
            <input className="form-input" type="password" placeholder="Key passphrase" value={form.passphrase} onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))}/>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? 'Saving...' : 'Save Key'}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {keys.map(k => (
          <div key={k.id} style={{ background: 'var(--color-base-750)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-200)', fontSize: 'var(--text-sm)' }}>{k.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-500)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                🔒 Encrypted with safeStorage (OS Keychain)
              </div>
            </div>
            <button className="btn btn-icon btn-sm" style={{ color: 'var(--color-danger-500)', flexShrink: 0 }} onClick={() => del(k.id, k.name)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        ))}
        {keys.length === 0 && !showForm && (
          <div className="empty-state" style={{ padding: '40px' }}>
            <Key size={28} className="empty-state-icon"/>
            <p className="empty-state-title">No saved SSH keys yet</p>
            <p className="empty-state-desc">Save your SSH private keys here to reuse them when creating connections</p>
          </div>
        )}
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
