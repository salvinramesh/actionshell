import { useState } from 'react'
import { useAuthStore } from '../../store/auth.store'
import './Auth.module.css'

interface Props { onUnlock: () => void }

export default function LockScreen({ onUnlock }: Props) {
  const { session, setSession, setLocked, logout } = useAuthStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const initials = session?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || 'AS'

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await window.actionshell.auth.login({ email: session!.email, password })
      if (res.success && res.data) {
        setSession(res.data)
        setLocked(false)
        onUnlock()
      } else {
        setError(res.error || 'Incorrect password')
      }
    } catch { setError('Unlock failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg-grid" />
      <div className="auth-card animate-scaleIn" style={{maxWidth:'360px'}}>
        <div className="auth-logo">
          <div className="lock-avatar">{initials}</div>
          <h1 style={{marginTop:'16px'}}>Session Locked</h1>
          <p>{session?.name} · {session?.email}</p>
        </div>
        <form onSubmit={handleUnlock}>
          <div className="form-group">
            <label className="form-label">Password to unlock</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
          </div>
          {error && <p className="form-error" style={{textAlign:'center'}}>{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%',padding:'10px'}}>
            {loading ? <><span className="spinner"/>Unlocking...</> : '🔓 Unlock'}
          </button>
        </form>
        <button className="btn btn-ghost" onClick={() => logout()} style={{width:'100%',fontSize:'var(--text-sm)'}}>
          Switch Account
        </button>
      </div>
    </div>
  )
}
