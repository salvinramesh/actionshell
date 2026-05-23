import { api } from './api.service'
import type {
  SSHHost, HostGroup, Credential, ServerPermission,
  CreateHostRequest, CreateCredentialRequest, GrantPermissionRequest,
  UserRole
} from '../../../shared/types'

/**
 * Get hosts accessible to user (server handles permission filtering)
 */
export async function getHosts(_userId: string, _userRole: UserRole): Promise<SSHHost[]> {
  const res = await api.get<{ hosts: any[] }>('/hosts')
  if (!res.ok) return []

  return res.data.hosts.map(parseHost)
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
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []),
    notes: r.notes,
    isFavorite: Boolean(r.is_favorite),
    jumpHostId: r.jump_host_id,
    keepaliveInterval: r.keepalive_interval,
    connectionTimeout: r.connection_timeout,
    createdBy: r.created_by,
    createdAt: r.created_at,
    metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}),
  }
}

/**
 * Create a new SSH host
 */
export async function createHost(
  data: CreateHostRequest,
  _userId: string
): Promise<{ success: boolean; data?: SSHHost; error?: string }> {
  const res = await api.post<{ host: any; error?: string }>('/hosts', data)
  if (!res.ok) return { success: false, error: (res.data as any).error }
  return { success: true, data: parseHost(res.data.host) }
}

/**
 * Update SSH host
 */
export async function updateHost(
  id: string,
  data: Partial<CreateHostRequest>,
  _userId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await api.patch<{ error?: string }>(`/hosts/${id}`, data)
  return res.ok ? { success: true } : { success: false, error: (res.data as any).error }
}

/**
 * Delete SSH host
 */
export async function deleteHost(id: string, _userId: string): Promise<{ success: boolean; error?: string }> {
  const res = await api.delete<{ error?: string }>(`/hosts/${id}`)
  return res.ok ? { success: true } : { success: false, error: (res.data as any).error }
}

/**
 * Toggle favorite
 */
export async function toggleFavorite(id: string): Promise<void> {
  await api.patch(`/hosts/${id}/favorite`)
}

/**
 * Get all host groups
 */
export async function getGroups(): Promise<HostGroup[]> {
  const res = await api.get<{ groups: any[] }>('/groups')
  if (!res.ok) return []

  return res.data.groups.map((r: any) => ({
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    color: r.color,
    icon: r.icon,
    createdBy: r.created_by,
  }))
}

/**
 * Create host group
 */
export async function createGroup(
  data: { name: string; parentId?: string; color?: string; icon?: string },
  _userId: string
): Promise<HostGroup> {
  const res = await api.post<{ group: any }>('/groups', data)
  const g = res.data.group
  return {
    id: g.id, name: g.name, parentId: g.parent_id,
    color: g.color, icon: g.icon, createdBy: g.created_by,
  }
}

/**
 * Delete host group
 */
export async function deleteGroup(id: string): Promise<void> {
  await api.delete(`/groups/${id}`)
}

/**
 * Add credential for host (server encrypts it)
 */
export async function addCredential(
  data: CreateCredentialRequest,
  _userId: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  const res = await api.post<{ credential: { id: string }; error?: string }>('/credentials', {
    hostId: data.hostId,
    type: data.type,
    label: data.label,
    value: data.value,
    passphrase: data.passphrase,
  })
  if (!res.ok) return { success: false, error: (res.data as any).error }
  return { success: true, credentialId: res.data.credential?.id }
}

/**
 * Get credentials metadata (no values)
 */
export async function getCredentials(hostId: string): Promise<Credential[]> {
  const res = await api.get<{ credentials: any[] }>(`/credentials/${hostId}`)
  if (!res.ok) return []

  return res.data.credentials.map((r: any) => ({
    id: r.id,
    hostId: r.host_id,
    type: r.type,
    label: r.label,
    fingerprint: r.fingerprint,
    createdAt: r.created_at,
  }))
}

/**
 * Get decrypted credential value (for SSH connection)
 */
export async function getDecryptedCredential(credentialId: string): Promise<{
  value: string
  passphrase: string | null
  type: string
} | null> {
  const res = await api.get<{ value: string; passphrase: string | null; type: string }>(`/credentials/${credentialId}/decrypt`)
  if (!res.ok) return null
  return res.data
}

/**
 * Delete credential
 */
export async function deleteCredential(id: string, _userId: string): Promise<{ success: boolean }> {
  const res = await api.delete(`/credentials/${id}`)
  return { success: res.ok }
}

/**
 * Grant server permission
 */
export async function grantPermission(
  data: GrantPermissionRequest,
  _grantedBy: string
): Promise<{ success: boolean; error?: string }> {
  const res = await api.post<{ error?: string }>('/permissions', data)
  return res.ok ? { success: true } : { success: false, error: (res.data as any).error }
}

/**
 * Revoke server permission
 */
export async function revokePermission(permId: string, _actorId: string): Promise<{ success: boolean }> {
  const res = await api.delete(`/permissions/${permId}`)
  return { success: res.ok }
}

/**
 * Get permissions for a host
 */
export async function getHostPermissions(hostId: string): Promise<ServerPermission[]> {
  const res = await api.get<{ permissions: any[] }>(`/permissions/${hostId}`)
  if (!res.ok) return []

  return res.data.permissions.map((r: any) => ({
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
    isActive: Boolean(r.is_active),
  }))
}

/**
 * Get snippets
 */
export async function getSnippets(_userId: string, _userRole: UserRole) {
  const res = await api.get<{ snippets: any[] }>('/snippets')
  if (!res.ok) return []

  return res.data.snippets.map((r: any) => ({
    id: r.id,
    title: r.title,
    command: r.command,
    description: r.description,
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []),
    variables: typeof r.variables === 'string' ? JSON.parse(r.variables) : (r.variables || []),
    scope: r.scope,
    teamId: r.team_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
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
}, _userId: string): Promise<{ success: boolean; error?: string }> {
  const res = await api.post<{ error?: string }>('/snippets', data)
  return res.ok ? { success: true } : { success: false, error: (res.data as any).error }
}

/**
 * Delete snippet
 */
export function deleteSnippet(id: string, _userId: string): { success: boolean } {
  api.delete(`/snippets/${id}`)
  return { success: true }
}
