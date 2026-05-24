import { ipcMain } from 'electron'
import { startTunnel, stopTunnel, listTunnels } from '../services/tunnels.service'
import type { IpcResponse } from '../../../shared/types'

export function registerTunnelsIPC() {
  ipcMain.handle('tunnels:start', async (_, tunnel): Promise<IpcResponse> => {
    try {
      await startTunnel(tunnel)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('tunnels:stop', async (_, { id }): Promise<IpcResponse> => {
    try {
      await stopTunnel(id)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('tunnels:list', async (): Promise<IpcResponse> => {
    try {
      const list = listTunnels()
      return { success: true, data: list }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })
}
