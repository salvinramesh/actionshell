import { useEffect } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { useUIStore } from '../../store/ui.store'
import { useConnectionsStore } from '../../store/connections.store'
import TitleBar from './TitleBar'
import Sidebar from '../connections/Sidebar'
import TerminalManager from '../terminal/TerminalManager'
import AdminDashboard from '../admin/AdminDashboard'
import SettingsPanel from '../settings/SettingsPanel'
import ConnectionForm from '../connections/ConnectionForm'
import SnippetPalette from '../snippets/SnippetPalette'
import NotificationStack from '../ui/NotificationStack'
import './Layout.css'

export default function MainLayout() {
  const { session } = useAuthStore()
  const { currentView, sidebarCollapsed, showConnectionForm, showSnippetPalette } = useUIStore()
  const { loadHosts, loadGroups } = useConnectionsStore()

  useEffect(() => {
    if (session) {
      loadHosts(session.userId, session.role)
      loadGroups()
    }
  }, [session])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        useUIStore.getState().setShowSnippetPalette(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="app-root">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          {currentView === 'terminal' && <TerminalManager />}
          {currentView === 'admin' && <AdminDashboard />}
          {currentView === 'settings' && <SettingsPanel />}
        </main>
      </div>
      {showConnectionForm && <ConnectionForm />}
      {showSnippetPalette && <SnippetPalette />}
      <NotificationStack />
    </div>
  )
}
