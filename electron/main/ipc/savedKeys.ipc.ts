import { ipcMain } from 'electron'
import { getSavedKeys, addSavedKey, deleteSavedKey } from '../services/savedKeys.service'
import type { IpcResponse } from '../../../shared/types'

export function registerSavedKeysIPC() {
  ipcMain.handle('saved-keys:list', async (): Promise<IpcResponse> => {
    try {
      const keys = getSavedKeys()
      return { success: true, data: keys }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to list saved keys' }
    }
  })

  ipcMain.handle('saved-keys:add', async (_, { name, key, passphrase }): Promise<IpcResponse> => {
    try {
      if (!name || !key) {
        return { success: false, error: 'Name and key content are required' }
      }
      const newKey = addSavedKey(name, key, passphrase)
      return { success: true, data: newKey }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to add saved key' }
    }
  })

  ipcMain.handle('saved-keys:delete', async (_, { id }): Promise<IpcResponse> => {
    try {
      const success = deleteSavedKey(id)
      return { success }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete saved key' }
    }
  })
}
