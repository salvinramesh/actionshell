import { ipcMain, BrowserWindow, dialog } from 'electron'
import {
  getHosts, createHost, updateHost, deleteHost, toggleFavorite,
  getGroups, createGroup, deleteGroup,
  addCredential, getCredentials, getDecryptedCredential, deleteCredential,
  getHostPermissions, grantPermission, revokePermission,
  getSnippets, createSnippet, deleteSnippet
} from '../services/connections.service'
import { testConnection } from '../services/ssh.service'
import type { IpcResponse, UserRole } from '../../../shared/types'

export function registerConnectionsIPC(mainWindow: BrowserWindow) {
  // Hosts
  ipcMain.handle('connections:list', async (_, { userId, userRole }): Promise<IpcResponse> => {
    return { success: true, data: await getHosts(userId, userRole) }
  })

  ipcMain.handle('connections:create', async (_, { data, userId }): Promise<IpcResponse> => {
    return await createHost(data, userId)
  })

  ipcMain.handle('connections:update', async (_, { id, data, userId }): Promise<IpcResponse> => {
    return await updateHost(id, data, userId)
  })

  ipcMain.handle('connections:delete', async (_, { id, userId }): Promise<IpcResponse> => {
    return await deleteHost(id, userId)
  })

  ipcMain.handle('connections:favorite', async (_, { id }): Promise<IpcResponse> => {
    await toggleFavorite(id)
    return { success: true }
  })

  ipcMain.handle('connections:test', async (_, { hostId }): Promise<IpcResponse> => {
    const result = await testConnection(hostId)
    return { success: result.success, data: result, error: result.error }
  })

  // Groups
  ipcMain.handle('connections:groups:list', async (): Promise<IpcResponse> => {
    return { success: true, data: await getGroups() }
  })

  ipcMain.handle('connections:groups:create', async (_, { data, userId }): Promise<IpcResponse> => {
    const group = await createGroup(data, userId)
    return { success: true, data: group }
  })

  ipcMain.handle('connections:groups:delete', async (_, { id }): Promise<IpcResponse> => {
    await deleteGroup(id)
    return { success: true }
  })

  // Credentials
  ipcMain.handle('credentials:add', async (_, { data, userId }): Promise<IpcResponse> => {
    return await addCredential(data, userId)
  })

  ipcMain.handle('credentials:list', async (_, { hostId }): Promise<IpcResponse> => {
    return { success: true, data: await getCredentials(hostId) }
  })

  ipcMain.handle('credentials:decrypt', async (_, { credentialId }): Promise<IpcResponse> => {
    const result = await getDecryptedCredential(credentialId)
    if (!result) return { success: false, error: 'Credential not found' }
    return { success: true, data: result }
  })

  ipcMain.handle('credentials:delete', async (_, { id, userId }): Promise<IpcResponse> => {
    return await deleteCredential(id, userId)
  })

  // Server permissions (admin)
  ipcMain.handle('admin:permissions:list', async (_, { hostId }): Promise<IpcResponse> => {
    return { success: true, data: await getHostPermissions(hostId) }
  })

  ipcMain.handle('admin:permissions:grant', async (_, { data, actorId }): Promise<IpcResponse> => {
    return await grantPermission(data, actorId)
  })

  ipcMain.handle('admin:permissions:revoke', async (_, { permId, actorId }): Promise<IpcResponse> => {
    return await revokePermission(permId, actorId)
  })

  // Snippets
  ipcMain.handle('snippets:list', async (_, { userId, userRole }): Promise<IpcResponse> => {
    return { success: true, data: await getSnippets(userId, userRole) }
  })

  ipcMain.handle('snippets:create', async (_, { data, userId }): Promise<IpcResponse> => {
    return await createSnippet(data, userId)
  })

  ipcMain.handle('snippets:delete', async (_, { id, userId }): Promise<IpcResponse> => {
    deleteSnippet(id, userId)
    return { success: true }
  })
}
