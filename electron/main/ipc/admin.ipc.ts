import { ipcMain, BrowserWindow } from 'electron'
import { getAuditLogs } from '../services/audit.service'
import { getRawDb } from '../db/database'
import type { IpcResponse } from '../../../shared/types'

export function registerAdminIPC(mainWindow: BrowserWindow) {
  ipcMain.handle('admin:audit:list', async (_, filters): Promise<IpcResponse> => {
    return { success: true, data: getAuditLogs(filters || {}) }
  })

  ipcMain.handle('admin:sessions:list', async (): Promise<IpcResponse> => {
    const db = getRawDb()
    const rows = db.prepare(`
      SELECT s.*, u.name as user_name, u.email as user_email, h.name as host_name
      FROM active_sessions s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN ssh_hosts h ON s.host_id = h.id
      WHERE s.is_alive = 1
      ORDER BY s.started_at DESC
    `).all() as any[]
    
    const sessions = rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      hostId: r.host_id,
      hostName: r.host_name,
      sessionType: r.session_type,
      startedAt: r.started_at,
      lastActivityAt: r.last_activity_at,
      isAlive: Boolean(r.is_alive)
    }))
    
    return { success: true, data: sessions }
  })

  ipcMain.handle('admin:stats', async (): Promise<IpcResponse> => {
    const db = getRawDb()
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c
    const hostCount = (db.prepare('SELECT COUNT(*) as c FROM ssh_hosts').get() as any).c
    const activeSessionCount = (db.prepare('SELECT COUNT(*) as c FROM active_sessions WHERE is_alive = 1').get() as any).c
    const recentLogins = (db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE action = 'AUTH_LOGIN' AND created_at > datetime('now', '-24 hours')").get() as any).c
    
    return {
      success: true,
      data: { userCount, hostCount, activeSessionCount, recentLogins }
    }
  })
}
