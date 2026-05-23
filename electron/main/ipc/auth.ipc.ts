import { ipcMain, BrowserWindow } from 'electron'
import {
  isSetupRequired, setupSuperAdmin, login, logout,
  validateSession, getUsers, getPendingUsers, createUser, updateUser, deleteUser,
  register, approveUser, rejectUser
} from '../services/auth.service'
import type { IpcResponse } from '../../../shared/types'

export function registerAuthIPC(mainWindow: BrowserWindow) {
  ipcMain.handle('auth:is-setup-required', async (): Promise<IpcResponse<boolean>> => {
    return { success: true, data: await isSetupRequired() }
  })

  ipcMain.handle('auth:setup', async (_, data): Promise<IpcResponse> => {
    return await setupSuperAdmin(data)
  })

  ipcMain.handle('auth:register', async (_, data): Promise<IpcResponse> => {
    const result = await register(data)
    if (result.success && result.session) {
      return { success: true, data: result.session }
    }
    if (result.success && result.pending) {
      return { success: true, data: { pending: true } }
    }
    return { success: false, error: result.error }
  })

  ipcMain.handle('auth:login', async (_, data): Promise<IpcResponse> => {
    const result = await login(data)
    if (result.success && result.session) {
      return { success: true, data: result.session }
    }
    return { success: false, error: result.error }
  })

  ipcMain.handle('auth:logout', async (_, token): Promise<IpcResponse> => {
    await logout(token)
    return { success: true }
  })

  ipcMain.handle('auth:validate', async (_, token): Promise<IpcResponse> => {
    const session = validateSession(token)
    if (session) return { success: true, data: session }
    return { success: false, error: 'Session expired' }
  })

  // User management (admin only)
  ipcMain.handle('admin:users:list', async (): Promise<IpcResponse> => {
    return { success: true, data: await getUsers() }
  })

  ipcMain.handle('admin:users:pending', async (): Promise<IpcResponse> => {
    return { success: true, data: await getPendingUsers() }
  })

  ipcMain.handle('admin:users:approve', async (_, { id }): Promise<IpcResponse> => {
    return await approveUser(id)
  })

  ipcMain.handle('admin:users:reject', async (_, { id }): Promise<IpcResponse> => {
    return await rejectUser(id)
  })

  ipcMain.handle('admin:users:create', async (_, data): Promise<IpcResponse> => {
    return await createUser(data)
  })

  ipcMain.handle('admin:users:update', async (_, { id, data, actorId }): Promise<IpcResponse> => {
    return await updateUser(id, data, actorId)
  })

  ipcMain.handle('admin:users:delete', async (_, { id, actorId }): Promise<IpcResponse> => {
    return await deleteUser(id, actorId)
  })
}
