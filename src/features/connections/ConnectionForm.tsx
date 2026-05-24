import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { useConnectionsStore } from '../../store/connections.store'
import { useUIStore } from '../../store/ui.store'
import type { SSHHost, HostGroup, CreateHostRequest, CreateCredentialRequest, CredentialType } from '../../../shared/types'
import { X, Server, Key, Lock, ChevronDown } from 'lucide-react'

export default function ConnectionForm() {
  const { session } = useAuthStore()
  const { editingHostId, setShowConnectionForm } = useUIStore()
  const { hosts, loadHosts, loadGroups, groups } = useConnectionsStore()
  const { addNotification } = useUIStore()

  const editing = editingHostId ? hosts.find(h => h.id === editingHostId) : null
  const [tab, setTab] = useState<'general' | 'auth' | 'advanced'>('general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: editing?.name || '',
    hostname: editing?.hostname || '',
    port: editing?.port || 22,
    username: editing?.username || '',
    authType: editing?.authType || 'password' as 'password'|'key'|'agent',
    groupId: editing?.groupId || '',
    tags: editing?.tags.join(', ') || '',
    notes: editing?.notes || '',
    isFavorite: editing?.isFavorite || false,
    connectionTimeout: editing?.connectionTimeout || 30,
    keepaliveInterval: editing?.keepaliveInterval || 0,
    jumpHostId: editing?.jumpHostId || '',
    // Auth
    password: '',
    privateKey: '',
    passphrase: '',
    credentialLabel: '',
    credType: (editing?.authType === 'key' ? 'openssh' : 'password') as CredentialType,
  })

  useEffect(() => {
    async function loadCredentialDetails() {
      if (editingHostId) {
        try {
          const res = await window.actionshell.credentials.list(editingHostId)
          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            const firstCred = res.data[0]
            setForm(f => ({
              ...f,
              credType: firstCred.type,
              credentialLabel: firstCred.label || '',
            }))
          }
        } catch (err) {
          console.error('Failed to load credential details:', err)
        }
      }
    }
    loadCredentialDetails()
  }, [editingHostId])

  const set = (k: keyof typeof form, v: any) => setForm(f => ({...f, [k]: v}))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const hostData: CreateHostRequest = {
        name: form.name, hostname: form.hostname, port: Number(form.port),
        username: form.username, authType: form.authType,
        groupId: form.groupId || undefined,
        tags: form.tags ? form.tags.split(',').map(t=>t.trim()).filter(Boolean) : [],
        notes: form.notes || undefined, isFavorite: form.isFavorite,
        connectionTimeout: Number(form.connectionTimeout),
        keepaliveInterval: form.keepaliveInterval ? Number(form.keepaliveInterval) : undefined,
        jumpHostId: form.jumpHostId || undefined,
      }

      let hostId = editingHostId
      if (editing) {
        await window.actionshell.connections.update(editingHostId!, hostData, session!.userId)
      } else {
        const res = await window.actionshell.connections.create(hostData, session!.userId)
        if (!res.success) { setError(res.error || 'Failed to create host'); setLoading(false); return }
        hostId = (res.data as SSHHost).id
      }

      // Save credential if provided
      if (hostId && (form.password || form.privateKey)) {
        const credData: CreateCredentialRequest = {
          hostId,
          type: form.authType === 'password' ? 'password' : form.credType,
          label: form.credentialLabel || undefined,
          value: form.authType === 'password' ? form.password : form.privateKey,
          passphrase: form.passphrase || undefined,
        }
        await window.actionshell.credentials.add(credData, session!.userId)
      }

      await loadHosts(session!.userId, session!.role)
      addNotification({ type:'success', title: editing ? 'Host updated' : 'Host added', message: form.name })
      setShowConnectionForm(false)
    } catch (err: any) { setError(err.message) }
  }

  const handleDelete = async () => {
    if (!editing) return
    if (confirm(`Are you sure you want to delete "${editing.name}"?`)) {
      setLoading(true); setError('')
      try {
        const res = await window.actionshell.connections.delete(editing.id, session!.userId)
        if (res.success) {
          await loadHosts(session!.userId, session!.role)
          addNotification({ type: 'success', title: 'Host deleted', message: editing.name })
          setShowConnectionForm(false)
        } else {
          setError(res.error || 'Failed to delete host')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const tabs = [
    { id:'general', label:'General' }, { id:'auth', label:'Authentication' }, { id:'advanced', label:'Advanced' }
  ]

  return (
    <div className="modal-overlay" onClick={() => setShowConnectionForm(false)}>
      <div className="modal animate-scaleIn" style={{maxWidth:'560px'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{editing ? 'Edit Host' : 'New SSH Host'}</h3>
          <button className="btn btn-icon" onClick={() => setShowConnectionForm(false)}><X size={16}/></button>
        </div>

        {/* Tab nav */}
        <div style={{display:'flex',borderBottom:'1px solid var(--color-border-subtle)',padding:'0 24px'}}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{padding:'10px 16px',fontSize:'var(--text-sm)',color:tab===t.id?'var(--color-accent-500)':'var(--color-text-500)',borderBottom:tab===t.id?'2px solid var(--color-accent-500)':'2px solid transparent',marginBottom:'-1px',transition:'all 120ms'}}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {tab === 'general' && (
              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                <div className="form-group">
                  <label className="form-label">Display Name *</label>
                  <input className="form-input" placeholder="My Production Server" value={form.name} onChange={e=>set('name',e.target.value)} required/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 100px',gap:'12px'}}>
                  <div className="form-group">
                    <label className="form-label">Hostname / IP *</label>
                    <input className="form-input" placeholder="192.168.1.1 or host.example.com" value={form.hostname} onChange={e=>set('hostname',e.target.value)} required/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Port</label>
                    <input className="form-input" type="number" min={1} max={65535} value={form.port} onChange={e=>set('port',e.target.value)}/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="form-input" placeholder="root" value={form.username} onChange={e=>set('username',e.target.value)}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Group</label>
                  <select className="form-input form-select" value={form.groupId} onChange={e=>set('groupId',e.target.value)}>
                    <option value="">No group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tags <span style={{color:'var(--color-text-700)'}}>(comma separated)</span></label>
                  <input className="form-input" placeholder="production, web, nginx" value={form.tags} onChange={e=>set('tags',e.target.value)}/>
                </div>
                <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',fontSize:'var(--text-sm)',color:'var(--color-text-400)'}}>
                  <input type="checkbox" checked={form.isFavorite} onChange={e=>set('isFavorite',e.target.checked)} style={{width:'16px',height:'16px'}}/>
                  Add to Favorites ⭐
                </label>
              </div>
            )}

            {tab === 'auth' && (
              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                <div className="form-group">
                  <label className="form-label">Authentication Method</label>
                  <select className="form-input form-select" value={form.authType}
                    onChange={e => {
                      const newAuthType = e.target.value as 'password'|'key'|'agent'
                      setForm(f => ({
                        ...f,
                        authType: newAuthType,
                        credType: newAuthType === 'password'
                          ? 'password'
                          : (f.credType === 'password' ? 'openssh' : f.credType)
                      }))
                    }}>
                    <option value="password">Password</option>
                    <option value="key">SSH Key</option>
                    <option value="agent">SSH Agent</option>
                  </select>
                </div>

                {form.authType === 'password' && (
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input className="form-input" type="password" placeholder="SSH password (encrypted at rest)" value={form.password} onChange={e=>set('password',e.target.value)}/>
                    <span className="form-hint">🔒 Stored with AES-256-GCM encryption</span>
                  </div>
                )}

                {form.authType === 'key' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Key Type</label>
                      <select className="form-input form-select" value={form.credType} onChange={e=>set('credType',e.target.value)}>
                        <option value="openssh">OpenSSH</option>
                        <option value="rsa">RSA</option>
                        <option value="ed25519">ED25519</option>
                        <option value="pem">PEM</option>
                        <option value="ppk">PuTTY PPK</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Private Key Content</label>
                      <textarea className="form-input form-textarea" rows={6} placeholder="Paste your private key here (-----BEGIN ... KEY-----)" value={form.privateKey} onChange={e=>set('privateKey',e.target.value)} style={{fontFamily:'var(--font-mono)',fontSize:'11px'}}/>
                      <span className="form-hint">🔒 Key content encrypted with AES-256-GCM</span>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Passphrase (if protected)</label>
                      <input className="form-input" type="password" placeholder="Key passphrase (optional)" value={form.passphrase} onChange={e=>set('passphrase',e.target.value)}/>
                    </div>
                  </>
                )}

                {form.authType === 'agent' && (
                  <div style={{background:'var(--color-base-700)',border:'1px solid var(--color-border-default)',borderRadius:'var(--radius-md)',padding:'16px',fontSize:'var(--text-sm)',color:'var(--color-text-500)'}}>
                    <Key size={16} style={{marginBottom:'8px',color:'var(--color-accent-500)'}}/><br/>
                    SSH Agent authentication will use keys loaded in your system SSH agent (ssh-add). No credentials are stored in ActionShell.
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Credential Label (optional)</label>
                  <input className="form-input" placeholder="e.g. Deploy Key, Admin Password" value={form.credentialLabel} onChange={e=>set('credentialLabel',e.target.value)}/>
                </div>
              </div>
            )}

            {tab === 'advanced' && (
              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                <div className="form-group">
                  <label className="form-label">Connection Timeout (seconds)</label>
                  <input className="form-input" type="number" min={5} max={120} value={form.connectionTimeout} onChange={e=>set('connectionTimeout',e.target.value)}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Keepalive Interval (seconds, 0=disabled)</label>
                  <input className="form-input" type="number" min={0} max={300} value={form.keepaliveInterval} onChange={e=>set('keepaliveInterval',e.target.value)}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Jump Host / Bastion (ProxyJump)</label>
                  <select className="form-input form-select" value={form.jumpHostId} onChange={e=>set('jumpHostId',e.target.value)}>
                    <option value="">None</option>
                    {hosts.filter(h=>h.id!==editingHostId).map(h=><option key={h.id} value={h.id}>{h.name} ({h.hostname})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-input form-textarea" placeholder="Notes about this server..." value={form.notes} onChange={e=>set('notes',e.target.value)}/>
                </div>
              </div>
            )}

            {error && <p className="form-error" style={{marginTop:'12px'}}>{error}</p>}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: editing ? 'space-between' : 'flex-end', alignItems: 'center' }}>
            {editing && (
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={loading}>
                Delete Host
              </button>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowConnectionForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><span className="spinner"/>Saving...</> : (editing ? 'Update Host' : 'Add Host')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
