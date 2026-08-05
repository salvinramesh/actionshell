import { ipcMain, BrowserWindow } from 'electron'
import {
  spawnSSHSession, sendInput as sendSSHInput, resizeTerminal as resizeSSH,
  closeSession, sshEvents, getActiveSessions
} from '../services/ssh.service'
import {
  spawnPTY, sendPTYInput, resizePTY, killPTY, ptyEvents
} from '../services/pty.service'
import type { IpcResponse } from '../../../shared/types'

export function registerTerminalIPC(mainWindow: BrowserWindow) {
  // Forward terminal output to renderer
  sshEvents.on('terminal:output', ({ sessionId, data }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:output', { sessionId, data })
    }
  })
  
  sshEvents.on('terminal:close', ({ sessionId }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:close', { sessionId })
    }
  })
  
  sshEvents.on('terminal:error', ({ sessionId, error }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:error', { sessionId, error })
    }
  })
  
  ptyEvents.on('terminal:output', ({ sessionId, data }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:output', { sessionId, data })
    }
  })
  
  ptyEvents.on('terminal:close', ({ sessionId }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:close', { sessionId })
    }
  })

  // SSH terminal
  ipcMain.handle('terminal:ssh:spawn', async (_, { sessionId, hostId, cols, rows, actorId, sshShellOptions }): Promise<IpcResponse> => {
    try {
      await spawnSSHSession(sessionId, hostId, cols, rows, actorId, sshShellOptions)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Local PTY terminal
  ipcMain.handle('terminal:local:spawn', async (_, { sessionId, shell, cols, rows }): Promise<IpcResponse> => {
    try {
      spawnPTY(sessionId, shell, cols, rows)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Send input
  ipcMain.handle('terminal:input', async (_, { sessionId, data, isLocal }): Promise<IpcResponse> => {
    if (isLocal) {
      sendPTYInput(sessionId, data)
    } else {
      sendSSHInput(sessionId, data)
    }
    return { success: true }
  })

  // Resize
  ipcMain.handle('terminal:resize', async (_, { sessionId, cols, rows, isLocal }): Promise<IpcResponse> => {
    if (isLocal) {
      resizePTY(sessionId, cols, rows)
    } else {
      resizeSSH(sessionId, cols, rows)
    }
    return { success: true }
  })

  // Close session
  ipcMain.handle('terminal:close', async (_, { sessionId, isLocal, actorId }): Promise<IpcResponse> => {
    if (isLocal) {
      killPTY(sessionId)
    } else {
      await closeSession(sessionId, actorId)
    }
    return { success: true }
  })

  // Get active sessions
  ipcMain.handle('terminal:sessions', async (): Promise<IpcResponse> => {
    return { success: true, data: getActiveSessions() }
  })
}
