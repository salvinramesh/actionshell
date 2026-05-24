import { contextBridge, ipcRenderer } from 'electron'

// Expose a typed, narrow API to renderer
const api = {
  // Auth
  auth: {
    isSetupRequired: () => ipcRenderer.invoke('auth:is-setup-required'),
    setup: (data: any) => ipcRenderer.invoke('auth:setup', data),
    register: (data: any) => ipcRenderer.invoke('auth:register', data),
    login: (data: any) => ipcRenderer.invoke('auth:login', data),
    logout: (token: string) => ipcRenderer.invoke('auth:logout', token),
    validate: (token: string) => ipcRenderer.invoke('auth:validate', token),
    me: () => ipcRenderer.invoke('auth:me'),
    mfaSetup: () => ipcRenderer.invoke('auth:mfa:setup'),
    mfaEnable: (secret: string, code: string) => ipcRenderer.invoke('auth:mfa:enable', { secret, code }),
    mfaDisable: () => ipcRenderer.invoke('auth:mfa:disable'),
  },
  
  // Admin - Users
  adminUsers: {
    list: () => ipcRenderer.invoke('admin:users:list'),
    pending: () => ipcRenderer.invoke('admin:users:pending'),
    approve: (id: string) => ipcRenderer.invoke('admin:users:approve', { id }),
    reject: (id: string) => ipcRenderer.invoke('admin:users:reject', { id }),
    create: (data: any) => ipcRenderer.invoke('admin:users:create', data),
    update: (id: string, data: any, actorId: string) => ipcRenderer.invoke('admin:users:update', { id, data, actorId }),
    delete: (id: string, actorId: string) => ipcRenderer.invoke('admin:users:delete', { id, actorId }),
  },
  
  // Admin - Dashboard
  admin: {
    stats: () => ipcRenderer.invoke('admin:stats'),
    auditList: (filters?: any) => ipcRenderer.invoke('admin:audit:list', filters),
    sessionsList: () => ipcRenderer.invoke('admin:sessions:list'),
    sessionsRecording: (sessionId: string) => ipcRenderer.invoke('admin:sessions:recording', { sessionId }),
    permissionsList: (hostId: string) => ipcRenderer.invoke('admin:permissions:list', { hostId }),
    permissionsGrant: (data: any, actorId: string) => ipcRenderer.invoke('admin:permissions:grant', { data, actorId }),
    permissionsRevoke: (permId: string, actorId: string) => ipcRenderer.invoke('admin:permissions:revoke', { permId, actorId }),
  },
  
  // Connections (hosts)
  connections: {
    list: (userId: string, userRole: string) => ipcRenderer.invoke('connections:list', { userId, userRole }),
    create: (data: any, userId: string) => ipcRenderer.invoke('connections:create', { data, userId }),
    update: (id: string, data: any, userId: string) => ipcRenderer.invoke('connections:update', { id, data, userId }),
    delete: (id: string, userId: string) => ipcRenderer.invoke('connections:delete', { id, userId }),
    favorite: (id: string) => ipcRenderer.invoke('connections:favorite', { id }),
    test: (hostId: string) => ipcRenderer.invoke('connections:test', { hostId }),
    groupsList: () => ipcRenderer.invoke('connections:groups:list'),
    groupsCreate: (data: any, userId: string) => ipcRenderer.invoke('connections:groups:create', { data, userId }),
    groupsDelete: (id: string) => ipcRenderer.invoke('connections:groups:delete', { id }),
  },
  
  credentials: {
    add: (data: any, userId: string) => ipcRenderer.invoke('credentials:add', { data, userId }),
    list: (hostId: string) => ipcRenderer.invoke('credentials:list', { hostId }),
    delete: (id: string, userId: string) => ipcRenderer.invoke('credentials:delete', { id, userId }),
  },

  // Saved Keys (local vault)
  savedKeys: {
    list: () => ipcRenderer.invoke('saved-keys:list'),
    add: (name: string, key: string, passphrase?: string) => ipcRenderer.invoke('saved-keys:add', { name, key, passphrase }),
    delete: (id: string) => ipcRenderer.invoke('saved-keys:delete', { id }),
  },
  
  // Terminal
  terminal: {
    spawnSSH: (sessionId: string, hostId: string, cols: number, rows: number, actorId: string) =>
      ipcRenderer.invoke('terminal:ssh:spawn', { sessionId, hostId, cols, rows, actorId }),
    spawnLocal: (sessionId: string, shell?: string, cols?: number, rows?: number) =>
      ipcRenderer.invoke('terminal:local:spawn', { sessionId, shell, cols, rows }),
    input: (sessionId: string, data: string, isLocal: boolean) =>
      ipcRenderer.invoke('terminal:input', { sessionId, data, isLocal }),
    resize: (sessionId: string, cols: number, rows: number, isLocal: boolean) =>
      ipcRenderer.invoke('terminal:resize', { sessionId, cols, rows, isLocal }),
    close: (sessionId: string, isLocal: boolean, actorId?: string) =>
      ipcRenderer.invoke('terminal:close', { sessionId, isLocal, actorId }),
    sessions: () => ipcRenderer.invoke('terminal:sessions'),
    onOutput: (callback: (data: { sessionId: string; data: string }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('terminal:output', handler)
      return () => ipcRenderer.removeListener('terminal:output', handler)
    },
    onClose: (callback: (data: { sessionId: string }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('terminal:close', handler)
      return () => ipcRenderer.removeListener('terminal:close', handler)
    },
    onError: (callback: (data: { sessionId: string; error: string }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('terminal:error', handler)
      return () => ipcRenderer.removeListener('terminal:error', handler)
    },
  },
  
  // SFTP
  sftp: {
    connect: (sessionId: string, hostId: string) => ipcRenderer.invoke('sftp:connect', { sessionId, hostId }),
    list: (sessionId: string, path: string) => ipcRenderer.invoke('sftp:list', { sessionId, path }),
    upload: (sessionId: string, localPath: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:upload', { sessionId, localPath, remotePath }),
    download: (sessionId: string, remotePath: string, localPath: string) =>
      ipcRenderer.invoke('sftp:download', { sessionId, remotePath, localPath }),
    delete: (sessionId: string, path: string, isDir: boolean) =>
      ipcRenderer.invoke('sftp:delete', { sessionId, path, isDir }),
    rename: (sessionId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('sftp:rename', { sessionId, oldPath, newPath }),
    mkdir: (sessionId: string, path: string) => ipcRenderer.invoke('sftp:mkdir', { sessionId, path }),
    chmod: (sessionId: string, path: string, mode: number) =>
      ipcRenderer.invoke('sftp:chmod', { sessionId, path, mode }),
    chown: (sessionId: string, path: string, uid: number, gid: number) =>
      ipcRenderer.invoke('sftp:chown', { sessionId, path, uid, gid }),
    disconnect: (sessionId: string) => ipcRenderer.invoke('sftp:disconnect', { sessionId }),
    pickFiles: () => ipcRenderer.invoke('sftp:pick-files'),
    pickSaveDir: () => ipcRenderer.invoke('sftp:pick-save-dir'),
    readTextFile: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:read-text-file', { sessionId, remotePath }),
    writeTextFile: (sessionId: string, remotePath: string, content: string) =>
      ipcRenderer.invoke('sftp:write-text-file', { sessionId, remotePath, content }),
    onProgress: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('sftp:transfer:progress', handler)
      return () => ipcRenderer.removeListener('sftp:transfer:progress', handler)
    },
  },

  // Tunnels
  tunnels: {
    start: (tunnel: any) => ipcRenderer.invoke('tunnels:start', tunnel),
    stop: (id: string) => ipcRenderer.invoke('tunnels:stop', { id }),
    list: () => ipcRenderer.invoke('tunnels:list'),
  },
  
  // Snippets
  snippets: {
    list: (userId: string, userRole: string) => ipcRenderer.invoke('snippets:list', { userId, userRole }),
    create: (data: any, userId: string) => ipcRenderer.invoke('snippets:create', { data, userId }),
    delete: (id: string, userId: string) => ipcRenderer.invoke('snippets:delete', { id, userId }),
  },
  
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },
  
  // App info
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
  },
  
  // Theme
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme: string) => ipcRenderer.invoke('theme:set', theme),
  },
}

contextBridge.exposeInMainWorld('actionshell', api)

export type ActionShellAPI = typeof api
