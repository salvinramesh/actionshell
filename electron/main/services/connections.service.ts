import { v4 as uuidv4 } from 'uuid'
import { getRawDb } from '../db/database'
import { encrypt, decrypt } from './vault.service'
import { writeAuditLog } from './audit.service'
import type {
  SSHHost, HostGroup, Credential, ServerPermission,
  CreateHostRequest, CreateCredentialRequest, GrantPermissionRequest,
  UserRole
} from '../../../shared/types'

/**
 * Get hosts accessible to a user (filters by permissions for non-admins)
 */
export function getHosts(userId: string, userRole: UserRole): SSHHost[] {
  const db = getRawDb()
  
  let rows: any[]
  
  if (userRole === 'super_admin' || userRole === 'admin') {
    // Admins see all hosts
    rows = db.prepare('SELECT h.*, g.name as group_name FROM ssh_hosts h LEFT JOIN host_groups g ON h.group_id = g.id ORDER BY h.is_favorite DESC, h.name ASC').all()
  } else {
    // Get hosts where user has explicit permission or via team membership
    rows = db.prepare(`
      SELECT DISTINCT h.*, g.name as group_name
      FROM ssh_hosts h
      LEFT JOIN host_groups g ON h.group_id = g.id
      WHERE h.id IN (
        SELECT host_id FROM server_permissions
        WHERE is_active = 1
          AND (expires_at IS NULL OR expires_at > datetime('now'))
          AND (
            (grantee_type = 'user' AND grantee_id = ?)
            OR
            (grantee_type = 'team' AND grantee_id IN (
              SELECT team_id FROM team_members WHERE user_id = ?
            ))
          )
      )
      ORDER BY h.is_favorite DESC, h.name ASC
    `).all(userId, userId)
  }
  
  return rows.map(parseHost)
}

function parseHost(r: any): SSHHost {
  return {
    id: r.id,
    name: r.name,
    hostname: r.hostname,
    port: r.port,
    username: r.username,
    authType: r.auth_type,
    groupId: r.group_id,
    groupName: r.group_name,
    tags: JSON.parse(r.tags || '[]'),
    notes: r.notes,
    isFavorite: Boolean(r.is_favorite),
    jumpHostId: r.jump_host_id,
    keepaliveInterval: r.keepalive_interval,
    connectionTimeout: r.connection_timeout,
    createdBy: r.created_by,
    createdAt: r.created_at,
    metadata: JSON.parse(r.metadata || '{}')
  }
}

/**
 * Create a new SSH host
 */
export async function createHost(
  data: CreateHostRequest,
  userId: string
): Promise<{ success: boolean; host?: SSHHost; error?: string }> {
  try {
    const db = getRawDb()
    const id = uuidv4()
    const now = new Date().toISOString()
    
    db.prepare(`
      INSERT INTO ssh_hosts (id, name, hostname, port, username, auth_type, group_id, tags, notes, is_favorite, jump_host_id, keepalive_interval, connection_timeout, created_by, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.name, data.hostname, data.port || 22, data.username,
      data.authType || 'password', data.groupId || null,
      JSON.stringify(data.tags || []), data.notes || null,
      data.isFavorite ? 1 : 0, data.jumpHostId || null,
      data.keepaliveInterval || null, data.connectionTimeout || 30,
      userId, now, JSON.stringify(data.metadata || {})
    )
    
    await writeAuditLog({
      actorId: userId,
      action: 'HOST_CREATED',
      resourceType: 'host',
      resourceId: id,
      resourceName: data.name,
      details: { hostname: data.hostname, port: data.port },
      severity: 'info'
    })
    
    const host = db.prepare('SELECT h.*, NULL as group_name FROM ssh_hosts h WHERE h.id = ?').get(id) as any
    return { success: true, host: parseHost(host) }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Update SSH host
 */
export async function updateHost(
  id: string,
  data: Partial<CreateHostRequest>,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getRawDb()
    const fields: string[] = []
    const values: unknown[] = []
    
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.hostname !== undefined) { fields.push('hostname = ?'); values.push(data.hostname) }
    if (data.port !== undefined) { fields.push('port = ?'); values.push(data.port) }
    if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username) }
    if (data.authType !== undefined) { fields.push('auth_type = ?'); values.push(data.authType) }
    if (data.groupId !== undefined) { fields.push('group_id = ?'); values.push(data.groupId) }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)) }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes) }
    if (data.isFavorite !== undefined) { fields.push('is_favorite = ?'); values.push(data.isFavorite ? 1 : 0) }
    if (data.jumpHostId !== undefined) { fields.push('jump_host_id = ?'); values.push(data.jumpHostId) }
    if (data.keepaliveInterval !== undefined) { fields.push('keepalive_interval = ?'); values.push(data.keepaliveInterval) }
    if (data.connectionTimeout !== undefined) { fields.push('connection_timeout = ?'); values.push(data.connectionTimeout) }
    if (data.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(data.metadata)) }
    
    if (fields.length === 0) return { success: true }
    
    values.push(id)
    db.prepare(`UPDATE ssh_hosts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    await writeAuditLog({
      actorId: userId,
      action: 'HOST_UPDATED',
      resourceType: 'host',
      resourceId: id,
      details: { fields: Object.keys(data) },
      severity: 'info'
    })
    
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Delete SSH host
 */
export async function deleteHost(id: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getRawDb()
    const host = db.prepare('SELECT name FROM ssh_hosts WHERE id = ?').get(id) as any
    db.prepare('DELETE FROM ssh_hosts WHERE id = ?').run(id)
    
    await writeAuditLog({
      actorId: userId,
      action: 'HOST_DELETED',
      resourceType: 'host',
      resourceId: id,
      resourceName: host?.name,
      severity: 'warning'
    })
    
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Toggle favorite
 */
export function toggleFavorite(id: string): void {
  const db = getRawDb()
  db.prepare('UPDATE ssh_hosts SET is_favorite = NOT is_favorite WHERE id = ?').run(id)
}

/**
 * Get all host groups
 */
export function getGroups(): HostGroup[] {
  const db = getRawDb()
  const rows = db.prepare('SELECT * FROM host_groups ORDER BY name ASC').all() as any[]
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    color: r.color,
    icon: r.icon,
    createdBy: r.created_by
  }))
}

/**
 * Create host group
 */
export function createGroup(data: { name: string; parentId?: string; color?: string; icon?: string }, userId: string): HostGroup {
  const db = getRawDb()
  const id = uuidv4()
  db.prepare('INSERT INTO host_groups (id, name, parent_id, color, icon, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, data.name, data.parentId || null, data.color || null, data.icon || null, userId)
  return { id, name: data.name, parentId: data.parentId || null, color: data.color || null, icon: data.icon || null, createdBy: userId }
}

/**
 * Delete host group
 */
export function deleteGroup(id: string): void {
  const db = getRawDb()
  // Move hosts out of this group
  db.prepare('UPDATE ssh_hosts SET group_id = NULL WHERE group_id = ?').run(id)
  db.prepare('DELETE FROM host_groups WHERE id = ?').run(id)
}

/**
 * Add credential for host
 */
export async function addCredential(
  data: CreateCredentialRequest,
  userId: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  try {
    const db = getRawDb()
    const id = uuidv4()
    const now = new Date().toISOString()
    
    const encryptedValue = encrypt(data.value)
    const encryptedPassphrase = data.passphrase ? encrypt(data.passphrase) : null
    
    db.prepare(`
      INSERT INTO credentials (id, host_id, type, label, encrypted_value, passphrase_encrypted, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.hostId, data.type, data.label || null, encryptedValue, encryptedPassphrase, userId, now)
    
    await writeAuditLog({
      actorId: userId,
      action: 'CREDENTIAL_ADDED',
      resourceType: 'host',
      resourceId: data.hostId,
      details: { type: data.type },
      severity: 'info'
    })
    
    return { success: true, credentialId: id }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Get credentials (metadata only, not the actual values)
 */
export function getCredentials(hostId: string): Credential[] {
  const db = getRawDb()
  const rows = db.prepare('SELECT id, host_id, type, label, fingerprint, created_at FROM credentials WHERE host_id = ?').all(hostId) as any[]
  return rows.map(r => ({
    id: r.id,
    hostId: r.host_id,
    type: r.type,
    label: r.label,
    fingerprint: r.fingerprint,
    createdAt: r.created_at
  }))
}

/**
 * Delete credential
 */
export async function deleteCredential(id: string, userId: string): Promise<{ success: boolean }> {
  const db = getRawDb()
  const cred = db.prepare('SELECT host_id, type FROM credentials WHERE id = ?').get(id) as any
  db.prepare('DELETE FROM credentials WHERE id = ?').run(id)
  
  await writeAuditLog({
    actorId: userId,
    action: 'CREDENTIAL_DELETED',
    resourceType: 'host',
    resourceId: cred?.host_id,
    details: { type: cred?.type },
    severity: 'warning'
  })
  
  return { success: true }
}

/**
 * Grant server permission
 */
export async function grantPermission(
  data: GrantPermissionRequest,
  grantedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getRawDb()
    
    // Check if permission already exists, update it
    const existing = db.prepare(`
      SELECT id FROM server_permissions
      WHERE host_id = ? AND grantee_type = ? AND grantee_id = ?
    `).get(data.hostId, data.granteeType, data.granteeId) as any
    
    const now = new Date().toISOString()
    
    if (existing) {
      db.prepare(`
        UPDATE server_permissions
        SET can_connect = ?, can_sftp = ?, can_tunnel = ?, is_temporary = ?, expires_at = ?, is_active = 1, granted_by = ?, granted_at = ?, revoked_at = NULL
        WHERE id = ?
      `).run(
        data.canConnect !== false ? 1 : 0,
        data.canSftp !== false ? 1 : 0,
        data.canTunnel ? 1 : 0,
        data.isTemporary ? 1 : 0,
        data.expiresAt || null,
        grantedBy, now, existing.id
      )
    } else {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO server_permissions (id, host_id, grantee_type, grantee_id, can_connect, can_sftp, can_tunnel, is_temporary, expires_at, granted_by, granted_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        id, data.hostId, data.granteeType, data.granteeId,
        data.canConnect !== false ? 1 : 0,
        data.canSftp !== false ? 1 : 0,
        data.canTunnel ? 1 : 0,
        data.isTemporary ? 1 : 0,
        data.expiresAt || null,
        grantedBy, now
      )
    }
    
    const host = db.prepare('SELECT name FROM ssh_hosts WHERE id = ?').get(data.hostId) as any
    
    await writeAuditLog({
      actorId: grantedBy,
      action: 'PERMISSION_GRANTED',
      resourceType: 'host',
      resourceId: data.hostId,
      resourceName: host?.name,
      details: { granteeType: data.granteeType, granteeId: data.granteeId },
      severity: 'info'
    })
    
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Revoke server permission
 */
export async function revokePermission(permId: string, actorId: string): Promise<{ success: boolean }> {
  const db = getRawDb()
  db.prepare('UPDATE server_permissions SET is_active = 0, revoked_at = ? WHERE id = ?')
    .run(new Date().toISOString(), permId)
  
  const perm = db.prepare('SELECT * FROM server_permissions WHERE id = ?').get(permId) as any
  
  await writeAuditLog({
    actorId,
    action: 'PERMISSION_REVOKED',
    resourceType: 'host',
    resourceId: perm?.host_id,
    details: { permId },
    severity: 'warning'
  })
  
  return { success: true }
}

/**
 * Get permissions for a host
 */
export function getHostPermissions(hostId: string): ServerPermission[] {
  const db = getRawDb()
  const rows = db.prepare(`
    SELECT p.*,
      CASE WHEN p.grantee_type = 'user' THEN u.name ELSE t.name END as grantee_name
    FROM server_permissions p
    LEFT JOIN users u ON p.grantee_type = 'user' AND p.grantee_id = u.id
    LEFT JOIN teams t ON p.grantee_type = 'team' AND p.grantee_id = t.id
    WHERE p.host_id = ?
    ORDER BY p.granted_at DESC
  `).all(hostId) as any[]
  
  return rows.map(r => ({
    id: r.id,
    hostId: r.host_id,
    granteeType: r.grantee_type,
    granteeId: r.grantee_id,
    granteeName: r.grantee_name,
    canConnect: Boolean(r.can_connect),
    canSftp: Boolean(r.can_sftp),
    canTunnel: Boolean(r.can_tunnel),
    isTemporary: Boolean(r.is_temporary),
    expiresAt: r.expires_at,
    grantedBy: r.granted_by,
    grantedAt: r.granted_at,
    isActive: Boolean(r.is_active)
  }))
}

/**
 * Get snippets
 */
export function getSnippets(userId: string, userRole: UserRole) {
  const db = getRawDb()
  
  const rows = db.prepare(`
    SELECT * FROM snippets
    WHERE scope = 'global'
      OR (scope = 'personal' AND created_by = ?)
      OR (scope = 'team' AND team_id IN (SELECT team_id FROM team_members WHERE user_id = ?))
    ORDER BY title ASC
  `).all(userId, userId) as any[]
  
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    command: r.command,
    description: r.description,
    tags: JSON.parse(r.tags || '[]'),
    variables: JSON.parse(r.variables || '[]'),
    scope: r.scope,
    teamId: r.team_id,
    createdBy: r.created_by,
    createdAt: r.created_at
  }))
}

/**
 * Create snippet
 */
export async function createSnippet(data: {
  title: string
  command: string
  description?: string
  tags?: string[]
  variables?: any[]
  scope?: string
  teamId?: string
}, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getRawDb()
    const id = uuidv4()
    const now = new Date().toISOString()
    
    db.prepare(`
      INSERT INTO snippets (id, title, command, description, tags, variables, scope, team_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.title, data.command, data.description || null,
      JSON.stringify(data.tags || []),
      JSON.stringify(data.variables || []),
      data.scope || 'personal', data.teamId || null, userId, now
    )
    
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Delete snippet
 */
export function deleteSnippet(id: string, userId: string): { success: boolean } {
  const db = getRawDb()
  db.prepare('DELETE FROM snippets WHERE id = ? AND (created_by = ? OR (SELECT role FROM users WHERE id = ?) IN (\'super_admin\', \'admin\'))').run(id, userId, userId)
  return { success: true }
}
