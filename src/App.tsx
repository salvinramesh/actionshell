import { useEffect, useState } from 'react'
import { useAuthStore } from './store/auth.store'
import { useUIStore } from './store/ui.store'
import SetupWizard from './features/auth/SetupWizard'
import LoginScreen from './features/auth/LoginScreen'
import LockScreen from './features/auth/LockScreen'
import MainLayout from './features/layout/MainLayout'
import TitleBar from './features/layout/TitleBar'

type AppState = 'loading' | 'setup' | 'login' | 'locked' | 'app'

export default function App() {
  const { session, isLocked, restoreSession } = useAuthStore()
  const { theme } = useUIStore()
  const [appState, setAppState] = useState<AppState>('loading')

  useEffect(() => {
    // Sync native theme with main process
    window.actionshell.theme.set(theme)

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const updateSystemTheme = () => {
        document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light')
      }
      updateSystemTheme()
      mediaQuery.addEventListener('change', updateSystemTheme)
      return () => mediaQuery.removeEventListener('change', updateSystemTheme)
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme])

  useEffect(() => {
    async function init() {
      // With sync server, there's no local setup step.
      // LoginScreen has a Register tab — first user auto-becomes Super Admin.
      // Try to restore session
      const restored = await restoreSession()
      if (restored) { setAppState('app'); return }

      setAppState('login')
    }
    init()
  }, [])

  useEffect(() => {
    if (appState === 'loading') return
    if (isLocked) {
      setAppState('locked')
    } else if (session) {
      setAppState('app')
    } else {
      setAppState('login')
    }
  }, [session, isLocked])

  let content
  if (appState === 'loading') {
    content = <AppLoader />
  } else if (appState === 'setup') {
    content = <SetupWizard onComplete={() => setAppState('login')} />
  } else if (appState === 'login') {
    content = <LoginScreen onLogin={() => setAppState('app')} />
  } else if (appState === 'locked') {
    content = <LockScreen onUnlock={() => setAppState('app')} />
  } else {
    content = <MainLayout />
  }

  return (
    <div className="app-root">
      <TitleBar />
      <div className="app-body">
        {content}
      </div>
    </div>
  )
}

function AppLoader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', width:'100%', flex:1, background:'var(--color-base-800)', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="url(#grad)"/>
          <path d="M8 20l5-8 5 8M14 18h4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M20 12l4 4-4 4" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <defs><linearGradient id="grad" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#1A2238"/><stop offset="1" stopColor="#0A0E1A"/></linearGradient></defs>
        </svg>
        <span style={{ fontSize:'20px', fontWeight:700, color:'var(--color-text-200)', letterSpacing:'-0.02em' }}>ActionShell</span>
      </div>
      <div className="spinner" style={{ width:'20px', height:'20px' }} />
    </div>
  )
}
