import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../../store/auth.store'
import { useUIStore } from '../../store/ui.store'
import { useConnectionsStore } from '../../store/connections.store'
import type { User, AuditLog, ActiveSession } from '../../../shared/types'
import { Users, Server, Activity, Shield, BarChart2, Clock, LogOut, Lock, Unlock, Trash2, Plus, CheckCircle, XCircle, Pencil } from 'lucide-react'
import './Admin.css'

type AdminTab = 'overview' | 'users' | 'servers' | 'audit' | 'sessions'

export default function AdminDashboard() {
  const { session } = useAuthStore()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<User[]>([])
  const [audit, setAudit] = useState<AuditLog[]>([])
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)

  useEffect(() => {
    window.actionshell.admin.stats().then(r => { if(r.success) setStats(r.data) })
  }, [])

  const loadUsers = () => window.actionshell.adminUsers.list().then(r => { if(r.success) setUsers(r.data as User[]) })
  const loadAudit = () => window.actionshell.admin.auditList({limit:100}).then(r => { if(r.success) setAudit(r.data as AuditLog[]) })
  const loadSessions = () => window.actionshell.admin.sessionsList().then(r => { if(r.success) setActiveSessions(r.data as ActiveSession[]) })

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'audit') loadAudit()
    if (tab === 'sessions') loadSessions()
  }, [tab])

  const toggleUserLock = async (u: User) => {
    await window.actionshell.adminUsers.update(u.id, { isLocked: !u.isLocked }, session!.userId)
    loadUsers()
  }
  const deleteUser = async (u: User) => {
    if (!confirm(`Delete user ${u.email}?`)) return
    await window.actionshell.adminUsers.delete(u.id, session!.userId)
    loadUsers()
  }

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 size={15}/> },
    { id: 'users', label: 'Users', icon: <Users size={15}/> },
    { id: 'servers', label: 'Servers', icon: <Server size={15}/> },
    { id: 'audit', label: 'Audit Log', icon: <Activity size={15}/> },
    { id: 'sessions', label: 'Sessions', icon: <Clock size={15}/> },
  ]

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Shield size={16} style={{color:'var(--color-accent-500)'}}/>
          <span>Admin Panel</span>
        </div>
        {tabs.map(t => (
          <button key={t.id} className={`admin-nav-item ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="admin-content scrollable">
        {/* Overview */}
        {tab === 'overview' && stats && (
          <div className="admin-page animate-fadeIn">
            <h2 className="admin-page-title">Dashboard Overview</h2>
            <div className="stat-grid">
              <StatCard label="Total Users" value={stats.userCount} icon={<Users size={20}/>} color="cyan"/>
              <StatCard label="SSH Hosts" value={stats.hostCount} icon={<Server size={20}/>} color="green"/>
              <StatCard label="Active Sessions" value={stats.activeSessionCount} icon={<Activity size={20}/>} color="amber"/>
              <StatCard label="Logins (24h)" value={stats.recentLogins} icon={<Clock size={20}/>} color="slate"/>
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="admin-page animate-fadeIn">
            <div className="admin-page-header">
              <h2 className="admin-page-title">User Management</h2>
              <AddUserModal onCreated={loadUsers} />
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{fontWeight:'var(--weight-medium)',color:'var(--color-text-200)'}}>{u.name}</td>
                    <td className="mono" style={{fontSize:'var(--text-xs)'}}>{u.email}</td>
                    <td><span className={`badge ${u.role==='super_admin'?'badge-cyan':u.role==='admin'?'badge-amber':'badge-slate'}`}>{u.role.replace('_',' ')}</span></td>
                    <td>
                      {u.isLocked ? <span className="badge badge-red">Locked</span>
                        : u.isActive ? <span className="badge badge-green">Active</span>
                        : <span className="badge badge-slate">Inactive</span>}
                    </td>
                    <td style={{fontSize:'var(--text-xs)',color:'var(--color-text-500)'}}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{display:'flex',gap:'4px'}}>
                        <button className="btn btn-icon btn-sm" onClick={() => setEditingUser(u)} title="Edit User">
                          <Pencil size={12}/>
                        </button>
                        {u.id !== session?.userId && (
                          <>
                            <button className="btn btn-icon btn-sm" onClick={() => toggleUserLock(u)} title={u.isLocked?'Unlock':'Lock'}>
                              {u.isLocked ? <Unlock size={12}/> : <Lock size={12}/>}
                            </button>
                            <button className="btn btn-icon btn-sm" style={{color:'var(--color-danger-500)'}} onClick={() => deleteUser(u)} title="Delete">
                              <Trash2 size={12}/>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {editingUser && (
              <EditUserModal
                user={editingUser}
                onClose={() => setEditingUser(null)}
                onUpdated={() => {
                  setEditingUser(null)
                  loadUsers()
                }}
              />
            )}
          </div>
        )}

        {/* Audit Log */}
        {tab === 'audit' && (
          <div className="admin-page animate-fadeIn">
            <div className="admin-page-header">
              <h2 className="admin-page-title">Audit Log</h2>
              <button className="btn btn-ghost btn-sm" onClick={loadAudit}>Refresh</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Severity</th></tr></thead>
              <tbody>
                {audit.map(a => (
                  <tr key={a.id}>
                    <td style={{fontSize:'var(--text-xs)',color:'var(--color-text-500)',fontFamily:'var(--font-mono)'}}>{new Date(a.createdAt).toLocaleString()}</td>
                    <td style={{fontSize:'var(--text-xs)'}}>{a.actorEmail || '—'}</td>
                    <td><code style={{fontSize:'var(--text-xs)',color:'var(--color-accent-400)'}}>{a.action}</code></td>
                    <td style={{fontSize:'var(--text-xs)',color:'var(--color-text-500)'}}>{a.resourceName || a.resourceId || '—'}</td>
                    <td><span className={`badge ${a.severity==='critical'?'badge-red':a.severity==='warning'?'badge-amber':'badge-slate'}`}>{a.severity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sessions */}
        {tab === 'sessions' && (
          <div className="admin-page animate-fadeIn">
            <div className="admin-page-header">
              <h2 className="admin-page-title">Active Sessions</h2>
              <button className="btn btn-ghost btn-sm" onClick={loadSessions}>Refresh</button>
            </div>
            {activeSessions.length === 0 ? (
              <div className="empty-state"><Activity size={32} className="empty-state-icon"/><p className="empty-state-title">No active sessions</p></div>
            ) : (
              <table className="data-table">
                <thead><tr><th>User</th><th>Host</th><th>Type</th><th>Started</th><th>Status</th></tr></thead>
                <tbody>
                  {activeSessions.map(s => (
                    <tr key={s.id}>
                      <td>{(s as any).userName || s.userId}</td>
                      <td>{(s as any).hostName || s.hostId || '—'}</td>
                      <td><span className="badge badge-slate">{s.sessionType}</span></td>
                      <td style={{fontSize:'var(--text-xs)',color:'var(--color-text-500)'}}>{new Date(s.startedAt).toLocaleString()}</td>
                      <td><span className={`status-dot ${s.isAlive?'connected':'disconnected'}`}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'servers' && <ServersPermissionsTab />}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label:string; value:number; icon:React.ReactNode; color:string }) {
  const colors: Record<string,string> = { cyan:'var(--color-accent-glow)', green:'var(--color-success-glow)', amber:'var(--color-warning-glow)', slate:'var(--color-base-600)' }
  const fgColors: Record<string,string> = { cyan:'var(--color-accent-500)', green:'var(--color-success-500)', amber:'var(--color-warning-500)', slate:'var(--color-text-400)' }
  return (
    <div className="stat-card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <span style={{fontSize:'var(--text-sm)',color:'var(--color-text-500)'}}>{label}</span>
        <div style={{padding:'8px',background:colors[color],borderRadius:'var(--radius-md)',color:fgColors[color]}}>{icon}</div>
      </div>
      <div style={{fontSize:'var(--text-4xl)',fontWeight:'var(--weight-bold)',color:'var(--color-text-100)'}}>{value}</div>
    </div>
  )
}

function AddUserModal({ onCreated }: { onCreated: () => void }) {
  const { session } = useAuthStore()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'standard' as any })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const res = await window.actionshell.adminUsers.create({ ...form, createdBy: session!.userId })
    if (res.success) { setShow(false); setForm({ name:'', email:'', password:'', role:'standard' }); onCreated() }
    else setError(res.error || 'Failed')
    setLoading(false)
  }

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setShow(true)}><Plus size={13}/> Add User</button>
      {show && createPortal(
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Add User</h3></div>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                <div className="form-group"><label className="form-label">Name</label><input className="form-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" required value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" required value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Role</label>
                  <select className="form-input form-select" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value as any}))}>
                    <option value="admin">Admin</option><option value="standard">Standard User</option><option value="readonly">Read-only</option>
                  </select>
                </div>
                {error && <p className="form-error">{error}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShow(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading?<span className="spinner"/>:'Create User'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function EditUserModal({ user, onClose, onUpdated }: { user: User; onClose: () => void; onUpdated: () => void }) {
  const { session } = useAuthStore()
  const [form, setForm] = useState({ name: user.name, email: user.email, password: '', role: user.role })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const updateData: any = { name: form.name, role: form.role }
    if (form.password) updateData.password = form.password
    const res = await window.actionshell.adminUsers.update(user.id, updateData, session!.userId)
    if (res.success) { onUpdated() }
    else setError(res.error || 'Failed')
    setLoading(false)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-scaleIn" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Edit User</h3>
          <button className="btn btn-icon" onClick={onClose}><XCircle size={16}/></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" disabled value={form.email} style={{ opacity: 0.6, cursor: 'not-allowed' }}/>
            </div>
            <div className="form-group">
              <label className="form-label">Password (leave blank to keep current)</label>
              <input className="form-input" type="password" placeholder="Change password (optional)" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
                <option value="admin">Admin</option>
                <option value="standard">Standard User</option>
                <option value="readonly">Read-only</option>
              </select>
            </div>
            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner"/> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

function ServersPermissionsTab() {
  const { session } = useAuthStore()
  const { hosts } = useConnectionsStore()
  const [selectedHost, setSelectedHost] = useState<string|null>(null)
  const [permissions, setPermissions] = useState<any[]>([])
  
  // Grant modal states
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [grantForm, setGrantForm] = useState({
    userId: '',
    canConnect: true,
    canSftp: true,
    canTunnel: false,
    isTemporary: false,
    expiresAt: ''
  })
  const [grantError, setGrantError] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)

  const loadPerms = async (hostId: string) => {
    setSelectedHost(hostId)
    const res = await window.actionshell.admin.permissionsList(hostId)
    if (res.success) setPermissions(res.data as any[])
  }

  useEffect(() => {
    if (showGrantModal) {
      window.actionshell.adminUsers.list().then(r => {
        if (r.success) {
          const nonAdmins = (r.data as User[]).filter(u => u.role !== 'super_admin' && u.role !== 'admin')
          setUsers(nonAdmins)
          if (nonAdmins.length > 0) {
            setGrantForm(f => ({ ...f, userId: nonAdmins[0].id }))
          }
        }
      })
    }
  }, [showGrantModal])

  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!grantForm.userId) {
      setGrantError('Please select a user')
      return
    }
    setGrantLoading(true)
    setGrantError('')
    try {
      const data = {
        hostId: selectedHost!,
        granteeType: 'user',
        granteeId: grantForm.userId,
        canConnect: grantForm.canConnect,
        canSftp: grantForm.canSftp,
        canTunnel: grantForm.canTunnel,
        isTemporary: grantForm.isTemporary,
        expiresAt: grantForm.isTemporary && grantForm.expiresAt ? new Date(grantForm.expiresAt).toISOString() : null
      }
      const res = await window.actionshell.admin.permissionsGrant(data, session!.userId)
      if (res.success) {
        setShowGrantModal(false)
        setGrantForm({
          userId: '',
          canConnect: true,
          canSftp: true,
          canTunnel: false,
          isTemporary: false,
          expiresAt: ''
        })
        loadPerms(selectedHost!)
      } else {
        setGrantError(res.error || 'Failed to grant access')
      }
    } catch (err: any) {
      setGrantError(err.message || 'An error occurred')
    } finally {
      setGrantLoading(false)
    }
  }

  const handleRevoke = async (permId: string) => {
    if (!confirm('Are you sure you want to revoke this user\'s access to this server?')) return
    const res = await window.actionshell.admin.permissionsRevoke(permId, session!.userId)
    if (res.success) {
      loadPerms(selectedHost!)
    } else {
      alert(res.error || 'Failed to revoke permission')
    }
  }

  return (
    <div className="admin-page animate-fadeIn">
      <h2 className="admin-page-title">Server Access Control</h2>
      <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:'16px',marginTop:'16px'}}>
        <div style={{background:'var(--color-base-750)',border:'1px solid var(--color-border-subtle)',borderRadius:'var(--radius-lg)',overflow:'hidden'}}>
          {hosts.map(h => (
            <div key={h.id} className={`host-card ${selectedHost===h.id?'active':''}`} style={{padding:'10px 12px'}} onClick={() => loadPerms(h.id)}>
              <Server size={13} style={{color:'var(--color-text-600)',flexShrink:0}}/>
              <div><div style={{fontSize:'var(--text-sm)',fontWeight:'var(--weight-medium)',color:'var(--color-text-200)'}}>{h.name}</div>
              <div style={{fontSize:'var(--text-xs)',fontFamily:'var(--font-mono)',color:'var(--color-text-600)'}}>{h.hostname}</div></div>
            </div>
          ))}
        </div>
        <div>
          {selectedHost ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-200)' }}>
                  Active Access Grants
                </h3>
                <button className="btn btn-primary btn-sm" onClick={() => setShowGrantModal(true)}>
                  <Plus size={13}/> Grant Access
                </button>
              </div>
              <table className="data-table">
                <thead><tr><th>Grantee</th><th>Type</th><th>Connect</th><th>SFTP</th><th>Tunnel</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead>
                <tbody>
                  {permissions.map(p => (
                    <tr key={p.id}>
                      <td style={{fontWeight:'var(--weight-medium)'}}>{p.granteeName || p.granteeId}</td>
                      <td><span className="badge badge-slate">{p.granteeType}</span></td>
                      <td>{p.canConnect?<CheckCircle size={14} style={{color:'var(--color-success-500)'}}/>:<XCircle size={14} style={{color:'var(--color-danger-500)'}}/>}</td>
                      <td>{p.canSftp?<CheckCircle size={14} style={{color:'var(--color-success-500)'}}/>:<XCircle size={14} style={{color:'var(--color-danger-500)'}}/>}</td>
                      <td>{p.canTunnel?<CheckCircle size={14} style={{color:'var(--color-success-500)'}}/>:<XCircle size={14} style={{color:'var(--color-danger-500)'}}/>}</td>
                      <td><span className={`badge ${p.isActive?'badge-green':'badge-red'}`}>{p.isActive?'Active':'Revoked'}</span></td>
                      <td style={{fontSize:'var(--text-xs)',color:'var(--color-text-500)'}}>{p.expiresAt?new Date(p.expiresAt).toLocaleDateString():'Never'}</td>
                      <td>
                        {p.isActive && (
                          <button className="btn btn-icon btn-sm" style={{ color: 'var(--color-danger-500)', padding: '4px' }} onClick={() => handleRevoke(p.id)} title="Revoke Access">
                            <Trash2 size={12}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {permissions.length===0 && <div className="empty-state" style={{padding:'40px'}}><Shield size={28} className="empty-state-icon"/><p className="empty-state-title">No permissions set — Super Admin and Admins always have access</p></div>}
            </>
          ) : (
            <div className="empty-state" style={{padding:'60px'}}><Server size={32} className="empty-state-icon"/><p className="empty-state-title">Select a server</p></div>
          )}
        </div>
      </div>

      {showGrantModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowGrantModal(false)}>
          <div className="modal animate-scaleIn" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Grant Server Access</h3>
              <button className="btn btn-icon" onClick={() => setShowGrantModal(false)}><XCircle size={16}/></button>
            </div>
            <form onSubmit={handleGrantSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Select User</label>
                  {users.length === 0 ? (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-500)' }}>
                      No standard or read-only users found. All admins have immediate access.
                      </p>
                  ) : (
                    <select className="form-input form-select" value={grantForm.userId}
                      onChange={e => setGrantForm(f => ({ ...f, userId: e.target.value }))}>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--color-text-300)' }}>
                    <input type="checkbox" checked={grantForm.canConnect}
                      onChange={e => setGrantForm(f => ({ ...f, canConnect: e.target.checked }))}/>
                    SSH Terminal
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--color-text-300)' }}>
                    <input type="checkbox" checked={grantForm.canSftp}
                      onChange={e => setGrantForm(f => ({ ...f, canSftp: e.target.checked }))}/>
                    SFTP Client
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--color-text-300)' }}>
                    <input type="checkbox" checked={grantForm.canTunnel}
                      onChange={e => setGrantForm(f => ({ ...f, canTunnel: e.target.checked }))}/>
                    Tunnelling
                  </label>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--color-text-300)' }}>
                    <input type="checkbox" checked={grantForm.isTemporary}
                      onChange={e => setGrantForm(f => ({ ...f, isTemporary: e.target.checked }))}/>
                    Temporary Grant (Auto-expire)
                  </label>
                  {grantForm.isTemporary && (
                    <div style={{ marginTop: '8px' }}>
                      <label className="form-label">Expiry Date & Time</label>
                      <input className="form-input" type="datetime-local" required
                        value={grantForm.expiresAt} onChange={e => setGrantForm(f => ({ ...f, expiresAt: e.target.value }))}/>
                    </div>
                  )}
                </div>

                {grantError && <p className="form-error">{grantError}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowGrantModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={grantLoading || users.length === 0}>
                  {grantLoading ? <span className="spinner"/> : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
