import { ipcMain, BrowserWindow } from 'electron'
import { getAuditLogs } from '../services/audit.service'
import { api } from '../services/api.service'
import { getActiveSessions } from '../services/ssh.service'
import type { IpcResponse } from '../../../shared/types'

export function registerAdminIPC(mainWindow: BrowserWindow) {
  ipcMain.handle('admin:audit:list', async (_, filters): Promise<IpcResponse> => {
    return { success: true, data: await getAuditLogs(filters || {}) }
  })

  ipcMain.handle('admin:sessions:list', async (): Promise<IpcResponse> => {
    // Return local active SSH sessions (these are per-machine, not server-side)
    const sessions = getActiveSessions()
    return { success: true, data: sessions }
  })

  ipcMain.handle('admin:stats', async (): Promise<IpcResponse> => {
    // Fetch stats from server
    const usersRes = await api.get<{ users: any[] }>('/users')
    const hostsRes = await api.get<{ hosts: any[] }>('/hosts')
    const localSessions = getActiveSessions()

    const userCount = usersRes.ok ? usersRes.data.users.length : 0
    const hostCount = hostsRes.ok ? hostsRes.data.hosts.length : 0
    const activeSessionCount = localSessions.length

    return {
      success: true,
      data: { userCount, hostCount, activeSessionCount, recentLogins: 0 }
    }
  })
}
