import { app, BrowserWindow, shell, nativeTheme } from 'electron'
import path from 'path'
import { closeAllSessions } from './services/ssh.service'
import { closeAllSFTPSessions } from './services/sftp.service'
import { killAllPTY } from './services/pty.service'
import { closeAllTunnels } from './services/tunnels.service'
import { registerAuthIPC } from './ipc/auth.ipc'
import { registerConnectionsIPC } from './ipc/connections.ipc'
import { registerTerminalIPC } from './ipc/terminal.ipc'
import { registerSFTPIPC } from './ipc/sftp.ipc'
import { registerAdminIPC } from './ipc/admin.ipc'
import { registerSavedKeysIPC } from './ipc/savedKeys.ipc'
import { registerTunnelsIPC } from './ipc/tunnels.ipc'

// Disable hardware acceleration on Linux for stability
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,          // Custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#0A0E1A',
    show: false,
    icon: path.join(__dirname, '../../resources/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,       // Needed for node-pty in preload
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false
    }
  })

  // Handle external links
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('ready-to-show', () => {
    win.show()
    if (process.env.NODE_ENV === 'development') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  })

  win.on('close', (e) => {
    // Warn if active sessions
  })

  // Load app
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  // No local database needed — all data lives on the sync server
  mainWindow = createWindow()

  // Register all IPC handlers
  registerAuthIPC(mainWindow)
  registerConnectionsIPC(mainWindow)
  registerTerminalIPC(mainWindow)
  registerSFTPIPC(mainWindow)
  registerAdminIPC(mainWindow)
  registerSavedKeysIPC()

  // Window control IPC
  const { ipcMain } = await import('electron')
  
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized())
  
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:get-path', (_, name) => app.getPath(name as any))
  
  // Theme
  ipcMain.handle('theme:get', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  ipcMain.handle('theme:set', (_, theme) => {
    nativeTheme.themeSource = theme
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup()
    app.quit()
  }
})

app.on('before-quit', () => {
  cleanup()
})

function cleanup() {
  closeAllSessions()
  closeAllSFTPSessions()
  killAllPTY()
}

// Security: block new window creation
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      e.preventDefault()
    }
  })
})
