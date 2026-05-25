import { useEffect } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { useUIStore } from '../../store/ui.store'
import { useConnectionsStore } from '../../store/connections.store'
import Sidebar from '../connections/Sidebar'
import TerminalManager from '../terminal/TerminalManager'
import AdminDashboard from '../admin/AdminDashboard'
import SettingsPanel from '../settings/SettingsPanel'
import TunnelsManager from '../tunnels/TunnelsManager'
import ConnectionForm from '../connections/ConnectionForm'
import SnippetPalette from '../snippets/SnippetPalette'
import { useTerminalStore } from '../../store/terminal.store'
import { v4 as uuidv4 } from 'uuid'
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
      } else if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault()
        const sessionId = uuidv4()
        useTerminalStore.getState().addTab({
          sessionId,
          title: 'Local Shell',
          type: 'local',
          isLocal: true,
          status: 'connecting'
        })
        useUIStore.getState().setView('terminal')
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        const { activeTabId, removeTab } = useTerminalStore.getState()
        if (activeTabId) {
          e.preventDefault()
          removeTab(activeTabId)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <Sidebar />
      <main className="main-content">
        {currentView === 'terminal' && <TerminalManager />}
        {currentView === 'admin' && <AdminDashboard />}
        {currentView === 'settings' && <SettingsPanel />}
        {currentView === 'tunnels' && <TunnelsManager />}
      </main>
      {showConnectionForm && <ConnectionForm />}
      {showSnippetPalette && <SnippetPalette />}
      <NotificationStack />
    </>
  )
}
