import { useState } from 'react'
import { useAuthStore } from '../../store/auth.store'
import type { AuthSession } from '../../../shared/types'
import './Auth.module.css'

interface Props { onLogin: () => void }

export default function LoginScreen({ onLogin }: Props) {
  const { setSession } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await window.actionshell.auth.login(form)
      if (res.success && res.data) {
        setSession(res.data as AuthSession)
        onLogin()
      } else {
        setError(res.error || 'Login failed')
      }
    } catch { setError('Login failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg-grid" />
      <div className="auth-card animate-scaleIn">
        <div className="auth-logo">
          <AppLogo />
          <h1>Welcome back</h1>
          <p>Sign in to your ActionShell account</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="admin@company.com"
              value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required />
          </div>
          {error && <p className="form-error" style={{textAlign:'center'}}>{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%',padding:'10px'}}>
            {loading ? <><span className="spinner"/>Signing in...</> : 'Sign In'}
          </button>
        </form>
        <p className="auth-footer-note">ActionShell — Enterprise SSH & SFTP Manager</p>
      </div>
    </div>
  )
}

function AppLogo() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px',marginBottom:'8px'}}>
      <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="10" fill="url(#g2)"/>
        <path d="M10 26l6-10 6 10M17 23h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M25 14l5 5-5 5" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <defs><linearGradient id="g2" x1="0" y1="0" x2="40" y2="40"><stop stopColor="#1E2A44"/><stop offset="1" stopColor="#0A0E1A"/></linearGradient></defs>
      </svg>
      <span style={{fontSize:'22px',fontWeight:800,color:'var(--color-text-100)',letterSpacing:'-0.03em'}}>ActionShell</span>
    </div>
  )
}
