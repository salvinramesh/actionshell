import { useEffect, useState } from 'react'
import { useAuthStore } from './store/auth.store'
import { useUIStore } from './store/ui.store'
import SetupWizard from './features/auth/SetupWizard'
import LoginScreen from './features/auth/LoginScreen'
import LockScreen from './features/auth/LockScreen'
import MainLayout from './features/layout/MainLayout'
import TitleBar from './features/layout/TitleBar'
// @ts-ignore
import logo from './logo.png'

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

    // Redirect to login if session expires
    const unsubscribe = window.actionshell.auth.onExpired(() => {
      useAuthStore.getState().setSession(null)
    })

    return () => {
      unsubscribe()
    }
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
        <img src={logo} alt="ActionShell" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        <span style={{ fontSize:'20px', fontWeight:700, color:'var(--color-text-200)', letterSpacing:'-0.02em' }}>ActionShell</span>
      </div>
      <div className="spinner" style={{ width:'20px', height:'20px' }} />
    </div>
  )
}
