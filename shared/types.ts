// Shared types used by both main and renderer processes

export type UserRole = 'super_admin' | 'admin' | 'standard' | 'readonly'

export type AuthType = 'password' | 'key' | 'agent'

export type CredentialType = 'password' | 'pem' | 'ppk' | 'openssh' | 'rsa' | 'ed25519'

export type SessionType = 'ssh' | 'sftp' | 'tunnel' | 'local'

export type TunnelType = 'local' | 'remote' | 'dynamic'

export type SnippetScope = 'personal' | 'team' | 'global'

export type PermissionGranteeType = 'user' | 'team'

export type AuditSeverity = 'info' | 'warning' | 'critical'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  isLocked: boolean
  mfaEnabled: boolean
  lastLoginAt: string | null
  createdAt: string
  status?: string
}

export interface AuthSession {
  userId: string
  email: string
  name: string
  role: UserRole
  token: string
  expiresAt: number
}

export interface HostGroup {
  id: string
  name: string
  parentId: string | null
  color: string | null
  icon: string | null
  createdBy: string
  children?: HostGroup[]
}

export interface SSHHost {
  id: string
  name: string
  hostname: string
  port: number
  username: string | null
  authType: AuthType
  groupId: string | null
  groupName?: string
  tags: string[]
  notes: string | null
  isFavorite: boolean
  jumpHostId: string | null
  jumpHostName?: string
  keepaliveInterval: number | null
  connectionTimeout: number
  createdBy: string
  createdAt: string
  metadata: Record<string, unknown>
  // Runtime state
  status?: 'connected' | 'disconnected' | 'connecting' | 'error'
}

export interface Credential {
  id: string
  hostId: string
  type: CredentialType
  label: string | null
  fingerprint: string | null
  createdAt: string
  // Note: encrypted_value never sent to renderer
}

export interface ServerPermission {
  id: string
  hostId: string
  hostName?: string
  granteeType: PermissionGranteeType
  granteeId: string
  granteeName?: string
  canConnect: boolean
  canSftp: boolean
  canTunnel: boolean
  isTemporary: boolean
  expiresAt: string | null
  grantedBy: string
  grantedAt: string
  isActive: boolean
}

export interface Team {
  id: string
  name: string
  description: string | null
  createdBy: string
  createdAt: string
  memberCount?: number
}

export interface TeamMember {
  teamId: string
  userId: string
  userName?: string
  userEmail?: string
  role: 'owner' | 'member'
}

export interface Snippet {
  id: string
  title: string
  command: string
  description: string | null
  tags: string[]
  variables: SnippetVariable[]
  scope: SnippetScope
  teamId: string | null
  createdBy: string
  createdAt: string
}

export interface SnippetVariable {
  name: string
  default: string
  description: string
}

export interface SSHTunnel {
  id: string
  hostId: string
  name: string | null
  type: TunnelType
  localPort: number
  remoteHost: string
  remotePort: number
  isAutoStart: boolean
  // Runtime
  isActive?: boolean
}

export interface AuditLog {
  id: number
  actorId: string | null
  actorEmail: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  resourceName: string | null
  ipAddress: string | null
  details: Record<string, unknown> | null
  severity: AuditSeverity
  createdAt: string
}

export interface ActiveSession {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  hostId: string | null
  hostName?: string
  sessionType: SessionType
  startedAt: string
  lastActivityAt: string
  isAlive: boolean
}

export interface SFTPEntry {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  permissions: number
  owner: number
  group: number
  modifiedAt: string
  isHidden: boolean
}

export interface TransferItem {
  id: string
  type: 'upload' | 'download'
  localPath: string
  remotePath: string
  size: number
  transferred: number
  status: 'pending' | 'active' | 'paused' | 'complete' | 'error'
  error?: string
  sessionId: string
}

export interface TerminalTheme {
  id: string
  name: string
  isBuiltin: boolean
  themeData: {
    background: string
    foreground: string
    cursor: string
    cursorAccent: string
    selectionBackground: string
    black: string
    red: string
    green: string
    yellow: string
    blue: string
    magenta: string
    cyan: string
    white: string
    brightBlack: string
    brightRed: string
    brightGreen: string
    brightYellow: string
    brightBlue: string
    brightMagenta: string
    brightCyan: string
    brightWhite: string
  }
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  terminalFontSize: number
  terminalFontFamily: string
  terminalThemeId: string
  terminalScrollback: number
  terminalCursorBlink: boolean
  terminalCursorStyle: 'block' | 'underline' | 'bar'
  autoLockMinutes: number
  keepaliveInterval: number
  confirmOnClose: boolean
  showHiddenFiles: boolean
  sshAgentForwarding: boolean
  defaultShell: string
}

// IPC Request/Response types
export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface LoginRequest {
  email: string
  password: string
  mfaCode?: string
}

export interface SetupRequest {
  name: string
  email: string
  password: string
  masterPassword?: string
}

export interface CreateHostRequest {
  name: string
  hostname: string
  port: number
  username: string
  authType: AuthType
  groupId?: string
  tags?: string[]
  notes?: string
  isFavorite?: boolean
  jumpHostId?: string
  keepaliveInterval?: number
  connectionTimeout?: number
  metadata?: Record<string, unknown>
}

export interface CreateCredentialRequest {
  hostId: string
  type: CredentialType
  label?: string
  value: string  // plaintext — will be encrypted in main process
  passphrase?: string
}

export interface TerminalSpawnRequest {
  sessionId: string
  hostId?: string        // SSH if provided
  shell?: string         // Local shell if no hostId
  cols: number
  rows: number
}

export interface SFTPConnectRequest {
  sessionId: string
  hostId: string
}

export interface GrantPermissionRequest {
  hostId: string
  granteeType: PermissionGranteeType
  granteeId: string
  canConnect?: boolean
  canSftp?: boolean
  canTunnel?: boolean
  isTemporary?: boolean
  expiresAt?: string
}
