import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import path from 'path'
import {
  connectSFTP, listDirectory, uploadFile, downloadFile,
  deleteEntry, renameEntry, makeDirectory,
  changePermissions, changeOwnership, disconnectSFTP, sftpEvents
} from '../services/sftp.service'
import type { IpcResponse } from '../../../shared/types'

export function registerSFTPIPC(mainWindow: BrowserWindow) {
  // Forward transfer progress to renderer
  sftpEvents.on('transfer:progress', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sftp:transfer:progress', data)
    }
  })

  ipcMain.handle('sftp:connect', async (_, { sessionId, hostId }): Promise<IpcResponse> => {
    try {
      await connectSFTP(sessionId, hostId)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('sftp:list', async (_, { sessionId, path: remotePath }): Promise<IpcResponse> => {
    try {
      const entries = await listDirectory(sessionId, remotePath)
      return { success: true, data: entries }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('sftp:upload', async (_, { sessionId, localPath, remotePath }): Promise<IpcResponse> => {
    try {
      await uploadFile(sessionId, localPath, remotePath)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('sftp:download', async (_, { sessionId, remotePath, localPath }): Promise<IpcResponse> => {
    try {
      await downloadFile(sessionId, remotePath, localPath)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('sftp:delete', async (_, { sessionId, path: remotePath, isDir }): Promise<IpcResponse> => {
    try {
      await deleteEntry(sessionId, remotePath, isDir)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('sftp:rename', async (_, { sessionId, oldPath, newPath }): Promise<IpcResponse> => {
    try {
      await renameEntry(sessionId, oldPath, newPath)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('sftp:mkdir', async (_, { sessionId, path: remotePath }): Promise<IpcResponse> => {
    try {
      await makeDirectory(sessionId, remotePath)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('sftp:chmod', async (_, { sessionId, path: remotePath, mode }): Promise<IpcResponse> => {
    try {
      await changePermissions(sessionId, remotePath, mode)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('sftp:chown', async (_, { sessionId, path: remotePath, uid, gid }): Promise<IpcResponse> => {
    try {
      await changeOwnership(sessionId, remotePath, uid, gid)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('sftp:disconnect', async (_, { sessionId }): Promise<IpcResponse> => {
    await disconnectSFTP(sessionId)
    return { success: true }
  })

  // Native file picker for uploads
  ipcMain.handle('sftp:pick-files', async (): Promise<IpcResponse> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: 'Select files to upload'
    })
    if (result.canceled) return { success: false, error: 'Cancelled' }
    return { success: true, data: result.filePaths }
  })

  // Native folder picker for downloads
  ipcMain.handle('sftp:pick-save-dir', async (): Promise<IpcResponse> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select download destination'
    })
    if (result.canceled) return { success: false, error: 'Cancelled' }
    return { success: true, data: result.filePaths[0] }
  })

  // Read remote text file to local memory
  ipcMain.handle('sftp:read-text-file', async (_, { sessionId, remotePath }): Promise<IpcResponse> => {
    try {
      const fs = await import('fs')
      const tempPath = path.join(app.getPath('temp'), `actionshell-${Date.now()}-${path.basename(remotePath)}`)
      await downloadFile(sessionId, remotePath, tempPath)
      const data = fs.readFileSync(tempPath, 'utf8')
      try { fs.unlinkSync(tempPath) } catch {}
      return { success: true, data }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Write local memory text back to remote file
  ipcMain.handle('sftp:write-text-file', async (_, { sessionId, remotePath, content }): Promise<IpcResponse> => {
    try {
      const fs = await import('fs')
      const tempPath = path.join(app.getPath('temp'), `actionshell-${Date.now()}-${path.basename(remotePath)}`)
      fs.writeFileSync(tempPath, content, 'utf8')
      await uploadFile(sessionId, tempPath, remotePath)
      try { fs.unlinkSync(tempPath) } catch {}
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })
}

