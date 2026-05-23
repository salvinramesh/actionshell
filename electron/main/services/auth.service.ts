import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { getRawDb } from '../db/database'
import { writeAuditLog } from './audit.service'
import type { AuthSession, User, UserRole } from '../../../shared/types'

const SALT_ROUNDS = 12
const JWT_SECRET = 'actionshell-local-jwt-secret-' + process.pid // In-memory only
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// In-memory session store (no disk persistence for security)
const activeSessions = new Map<string, AuthSession>()

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

/**
 * Check if the app has been set up (any users exist)
 */
export function isSetupRequired(): boolean {
  const db = getRawDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  return row.count === 0
}

/**
 * First-run setup: create super admin
 */
export async function setupSuperAdmin(data: SetupData): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getRawDb()
    
    // Check already exists
    if (!isSetupRequired()) {
      return { success: false, error: 'Application already set up' }
    }
    
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
    const id = uuidv4()
    const now = new Date().toISOString()
    
    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, is_active, created_at)
      VALUES (?, ?, ?, ?, 'super_admin', 1, ?)
    `).run(id, data.email.toLowerCase(), data.name, passwordHash, now)
    
    await writeAuditLog({
      actorId: id,
      actorEmail: data.email,
      action: 'SYSTEM_SETUP',
      resourceType: 'system',
      details: { message: 'ActionShell initial setup completed' },
      severity: 'info'
    })
    
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Login user, return session
 */
export async function login(data: LoginData): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  const db = getRawDb()
  
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(data.email.toLowerCase()) as any
  
  if (!user) {
    return { success: false, error: 'Invalid email or password' }
  }
  
  // Check lockout
  if (user.locked_until) {
    const lockUntil = new Date(user.locked_until).getTime()
    if (Date.now() < lockUntil) {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000 / 60)
      return { success: false, error: `Account locked. Try again in ${remaining} minutes.` }
    } else {
      // Lockout expired, reset
      db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id)
    }
  }
  
  if (user.is_locked) {
    return { success: false, error: 'Account has been locked by an administrator' }
  }
  
  // Verify password
  const passwordMatch = await bcrypt.compare(data.password, user.password_hash)
  
  if (!passwordMatch) {
    const attempts = (user.failed_login_attempts || 0) + 1
    
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
      db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
        .run(attempts, lockUntil, user.id)
      
      await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: 'AUTH_LOCKOUT',
        resourceType: 'user',
        resourceId: user.id,
        details: { reason: 'Too many failed attempts' },
        severity: 'warning'
      })
      
      return { success: false, error: `Too many failed attempts. Account locked for 15 minutes.` }
    }
    
    db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id)
    
    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: 'AUTH_FAILED',
      details: { attempts },
      severity: 'warning'
    })
    
    return { success: false, error: 'Invalid email or password' }
  }
  
  // TODO: MFA check if enabled
  
  // Reset failed attempts on success
  db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?')
    .run(new Date().toISOString(), user.id)
  
  const session = createSession(user)
  
  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: 'AUTH_LOGIN',
    resourceType: 'user',
    resourceId: user.id,
    details: { role: user.role },
    severity: 'info'
  })
  
  return { success: true, session }
}

/**
 * Create an in-memory session
 */
function createSession(user: any): AuthSession {
  const expiresAt = Date.now() + SESSION_DURATION_MS
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: SESSION_DURATION_MS / 1000 }
  )
  
  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    token,
    expiresAt
  }
  
  activeSessions.set(token, session)
  return session
}

/**
 * Validate a session token
 */
export function validateSession(token: string): AuthSession | null {
  try {
    jwt.verify(token, JWT_SECRET)
    const session = activeSessions.get(token)
    if (!session) return null
    if (Date.now() > session.expiresAt) {
      activeSessions.delete(token)
      return null
    }
    return session
  } catch {
    return null
  }
}

/**
 * Logout / revoke session
 */
export async function logout(token: string): Promise<void> {
  const session = activeSessions.get(token)
  if (session) {
    activeSessions.delete(token)
    await writeAuditLog({
      actorId: session.userId,
      actorEmail: session.email,
      action: 'AUTH_LOGOUT',
      severity: 'info'
    })
  }
}

/**
 * Get all users (admin only)
 */
export function getUsers(): User[] {
  const db = getRawDb()
  const rows = db.prepare('SELECT id, email, name, role, is_active, is_locked, mfa_enabled, last_login_at, created_at FROM users ORDER BY created_at ASC').all() as any[]
  
  return rows.map(r => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role as UserRole,
    isActive: Boolean(r.is_active),
    isLocked: Boolean(r.is_locked),
    mfaEnabled: Boolean(r.mfa_enabled),
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at
  }))
}

/**
 * Create a new user
 */
export async function createUser(data: {
  name: string
  email: string
  password: string
  role: UserRole
  createdBy: string
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const db = getRawDb()
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email.toLowerCase())
    if (existing) {
      return { success: false, error: 'Email already in use' }
    }
    
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
    const id = uuidv4()
    const now = new Date().toISOString()
    
    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, data.email.toLowerCase(), data.name, passwordHash, data.role, now, data.createdBy)
    
    await writeAuditLog({
      actorId: data.createdBy,
      action: 'USER_CREATED',
      resourceType: 'user',
      resourceId: id,
      resourceName: data.email,
      details: { role: data.role },
      severity: 'info'
    })
    
    return { success: true, userId: id }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Update user
 */
export async function updateUser(
  targetId: string,
  data: Partial<{ name: string; role: UserRole; isActive: boolean; isLocked: boolean }>,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getRawDb()
    const fields: string[] = []
    const values: unknown[] = []
    
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role) }
    if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0) }
    if (data.isLocked !== undefined) { fields.push('is_locked = ?'); values.push(data.isLocked ? 1 : 0) }
    
    if (fields.length === 0) return { success: true }
    
    values.push(targetId)
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    await writeAuditLog({
      actorId,
      action: 'USER_UPDATED',
      resourceType: 'user',
      resourceId: targetId,
      details: data,
      severity: 'info'
    })
    
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Delete user
 */
export async function deleteUser(
  targetId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getRawDb()
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(targetId) as any
    
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId)
    
    await writeAuditLog({
      actorId,
      action: 'USER_DELETED',
      resourceType: 'user',
      resourceId: targetId,
      resourceName: user?.email,
      severity: 'warning'
    })
    
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}
