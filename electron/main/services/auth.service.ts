import { api, setAuthToken, getAuthToken } from './api.service'
import type { AuthSession, User, UserRole } from '../../../shared/types'

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

// In-memory session (mirrors server JWT)
let currentSession: AuthSession | null = null

export interface SetupData {
  name: string
  email: string
  password: string
}

export interface LoginData {
  email: string
  password: string
  mfaCode?: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
}

/**
 * Check if the app needs setup (no users on server)
 * We attempt login; if server has no users, registration page shows.
 * For simplicity: we try /api/health and let the UI decide.
 */
export async function isSetupRequired(): Promise<boolean> {
  // With the sync server, "setup" is just "register first user"
  // The UI shows Register form. First user auto-becomes super_admin.
  return currentSession === null
}

/**
 * Register a new user on the sync server
 */
export async function register(data: RegisterData): Promise<{
  success: boolean
  session?: AuthSession
  pending?: boolean
  error?: string
}> {
  const res = await api.post<{
    message: string
    user: { id: string; email: string; name: string; role: string; status: string }
    token?: string
  }>('/auth/register', data)

  if (!res.ok) {
    return { success: false, error: (res.data as any).error || 'Registration failed' }
  }

  // First user gets auto-login token
  if (res.data.token) {
    setAuthToken(res.data.token)
    currentSession = {
      userId: res.data.user.id,
      email: res.data.user.email,
      name: res.data.user.name,
      role: res.data.user.role as UserRole,
      token: res.data.token,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    }
    return { success: true, session: currentSession }
  }

  // Non-first user — pending approval
  return { success: true, pending: true }
}

/**
 * First-run setup: create super admin (just calls register)
 */
export async function setupSuperAdmin(data: SetupData): Promise<{ success: boolean; error?: string }> {
  const result = await register(data)
  if (!result.success) return { success: false, error: result.error }
  return { success: true }
}

/**
 * Login user via sync server
 */
export async function login(data: LoginData): Promise<{
  success: boolean
  session?: AuthSession
  error?: string
}> {
  const res = await api.post<{
    token: string
    user: { id: string; email: string; name: string; role: string; status: string }
    error?: string
  }>('/auth/login', data)

  if (!res.ok) {
    return { success: false, error: (res.data as any).error || 'Login failed' }
  }

  setAuthToken(res.data.token)
  currentSession = {
    userId: res.data.user.id,
    email: res.data.user.email,
    name: res.data.user.name,
    role: res.data.user.role as UserRole,
    token: res.data.token,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  }

  return { success: true, session: currentSession }
}

export function validateSession(token: string): AuthSession | null {
  if (!token) return null

  if (!currentSession || currentSession.token !== token) {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null

      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8')
      const payload = JSON.parse(payloadJson)

      const expiresAt = (payload.exp * 1000) || (Date.now() + SESSION_DURATION_MS)
      if (Date.now() > expiresAt) {
        setAuthToken(null)
        return null
      }

      currentSession = {
        userId: payload.id || payload.userId || payload.sub || '',
        email: payload.email || '',
        name: payload.name || '',
        role: (payload.role || 'standard') as UserRole,
        token,
        expiresAt,
      }
      setAuthToken(token)
    } catch (err) {
      console.error('Failed to restore session from token:', err)
      return null
    }
  }

  if (Date.now() > currentSession.expiresAt) {
    currentSession = null
    setAuthToken(null)
    return null
  }
  return currentSession
}

/**
 * Logout
 */
export async function logout(_token: string): Promise<void> {
  currentSession = null
  setAuthToken(null)
}

/**
 * Get all users (admin only)
 */
export async function getUsers(): Promise<User[]> {
  const res = await api.get<{ users: any[] }>('/users')
  if (!res.ok) return []

  return res.data.users.map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    isActive: u.status === 'active',
    isLocked: u.status === 'locked',
    mfaEnabled: Boolean(u.mfa_enabled),
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
    status: u.status,
  }))
}

/**
 * Get pending users (admin only)
 */
export async function getPendingUsers(): Promise<User[]> {
  const res = await api.get<{ users: any[] }>('/users?status=pending')
  if (!res.ok) return []

  return res.data.users.map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    isActive: false,
    isLocked: false,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: u.created_at,
    status: 'pending',
  }))
}

/**
 * Approve a pending user
 */
export async function approveUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const res = await api.patch<{ message: string; error?: string }>(`/users/${userId}/approve`)
  return res.ok ? { success: true } : { success: false, error: (res.data as any).error }
}

/**
 * Reject a pending user
 */
export async function rejectUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const res = await api.patch<{ message: string; error?: string }>(`/users/${userId}/reject`)
  return res.ok ? { success: true } : { success: false, error: (res.data as any).error }
}

/**
 * Create a new user (admin bypass — immediately active)
 */
export async function createUser(data: {
  name: string
  email: string
  password: string
  role: UserRole
  createdBy: string
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  const res = await api.post<{ user: { id: string }; error?: string }>('/users', data)
  return res.ok
    ? { success: true, userId: (res.data as any).user?.id }
    : { success: false, error: (res.data as any).error }
}

/**
 * Update user
 */
export async function updateUser(
  targetId: string,
  data: Partial<{ name: string; role: UserRole; isActive: boolean; isLocked: boolean; password?: string }>,
  _actorId: string
): Promise<{ success: boolean; error?: string }> {
  const body: any = {}
  if (data.name !== undefined) body.name = data.name
  if (data.role !== undefined) body.role = data.role
  if (data.isActive !== undefined) body.status = data.isActive ? 'active' : 'disabled'
  if (data.isLocked !== undefined) body.status = data.isLocked ? 'locked' : 'active'
  if (data.password !== undefined) body.password = data.password

  const res = await api.patch<{ error?: string }>(`/users/${targetId}`, body)
  return res.ok ? { success: true } : { success: false, error: (res.data as any).error }
}

/**
 * Delete user
 */
export async function deleteUser(
  targetId: string,
  _actorId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await api.delete<{ error?: string }>(`/users/${targetId}`)
  return res.ok ? { success: true } : { success: false, error: (res.data as any).error }
}
