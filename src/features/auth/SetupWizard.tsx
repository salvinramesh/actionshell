import { useState } from 'react'
import { useAuthStore } from '../../store/auth.store'
import './Auth.css'
// @ts-ignore
import logo from '../../logo.png'

interface Props { onComplete: () => void }

export default function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    try {
      const res = await window.actionshell.auth.setup({ name: form.name, email: form.email, password: form.password })
      if (res.success) onComplete()
      else setError(res.error || 'Setup failed')
    } catch { setError('Setup failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg-grid" />
      <div className="auth-card animate-scaleIn">
        <div className="auth-logo">
          <AppLogo />
          <h1>Welcome to ActionShell</h1>
          <p>Create your Super Admin account to get started</p>
        </div>
        <div className="auth-steps">
          {[1,2].map(s => <div key={s} className={`auth-step-dot ${step >= s ? 'active' : ''}`} />)}
        </div>
        {step === 1 ? (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2) }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="John Smith" value={form.name}
                onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="admin@company.com" value={form.email}
                onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
            </div>
            <button className="btn btn-primary" style={{width:'100%', marginTop:'8px'}} type="submit">Continue →</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Min 8 characters" value={form.password}
                onChange={e => setForm(f => ({...f, password: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className="form-input" type="password" placeholder="Repeat password" value={form.confirm}
                onChange={e => setForm(f => ({...f, confirm: e.target.value}))} required />
            </div>
            {error && <p className="form-error">{error}</p>}
            <div style={{display:'flex', gap:'8px', marginTop:'8px'}}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)} style={{flex:1}}>← Back</button>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{flex:2}}>
                {loading ? <span className="spinner"/> : 'Create Account'}
              </button>
            </div>
          </form>
        )}
        <p className="auth-footer-note">This is a local Super Admin account. You can create additional users after setup.</p>
      </div>
    </div>
  )
}

function AppLogo() {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'8px'}}>
      <img src={logo} alt="ActionShell" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
      <span style={{fontSize:'24px',fontWeight:800,color:'var(--color-text-100)',letterSpacing:'-0.03em'}}>ActionShell</span>
    </div>
  )
}
