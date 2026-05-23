// Drizzle ORM schema placeholder — we use raw SQL init in database.ts
// This file exports table references for typed queries

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('standard'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
  mfaSecret: text('mfa_secret'),
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).notNull().default(false),
  lastLoginAt: text('last_login_at'),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: text('locked_until'),
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by'),
})

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
})

export const teamMembers = sqliteTable('team_members', {
  teamId: text('team_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('member'),
})

export const hostGroups = sqliteTable('host_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  color: text('color'),
  icon: text('icon'),
  createdBy: text('created_by'),
})

export const sshHosts = sqliteTable('ssh_hosts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  hostname: text('hostname').notNull(),
  port: integer('port').notNull().default(22),
  username: text('username'),
  authType: text('auth_type').notNull().default('password'),
  groupId: text('group_id'),
  tags: text('tags').notNull().default('[]'),
  notes: text('notes'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  jumpHostId: text('jump_host_id'),
  keepaliveInterval: integer('keepalive_interval'),
  connectionTimeout: integer('connection_timeout').notNull().default(30),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  metadata: text('metadata').notNull().default('{}'),
})

export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  hostId: text('host_id').notNull(),
  type: text('type').notNull(),
  label: text('label'),
  encryptedValue: text('encrypted_value').notNull(),
  passphraseEncrypted: text('passphrase_encrypted'),
  fingerprint: text('fingerprint'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
})

export const serverPermissions = sqliteTable('server_permissions', {
  id: text('id').primaryKey(),
  hostId: text('host_id').notNull(),
  granteeType: text('grantee_type').notNull(),
  granteeId: text('grantee_id').notNull(),
  canConnect: integer('can_connect', { mode: 'boolean' }).notNull().default(true),
  canSftp: integer('can_sftp', { mode: 'boolean' }).notNull().default(true),
  canTunnel: integer('can_tunnel', { mode: 'boolean' }).notNull().default(false),
  isTemporary: integer('is_temporary', { mode: 'boolean' }).notNull().default(false),
  expiresAt: text('expires_at'),
  grantedBy: text('granted_by'),
  grantedAt: text('granted_at').notNull(),
  revokedAt: text('revoked_at'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

export const sshTunnels = sqliteTable('ssh_tunnels', {
  id: text('id').primaryKey(),
  hostId: text('host_id').notNull(),
  name: text('name'),
  type: text('type').notNull().default('local'),
  localPort: integer('local_port').notNull(),
  remoteHost: text('remote_host').notNull(),
  remotePort: integer('remote_port').notNull(),
  isAutoStart: integer('is_auto_start', { mode: 'boolean' }).notNull().default(false),
})

export const snippets = sqliteTable('snippets', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  command: text('command').notNull(),
  description: text('description'),
  tags: text('tags').notNull().default('[]'),
  variables: text('variables').notNull().default('[]'),
  scope: text('scope').notNull().default('personal'),
  teamId: text('team_id'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
})

export const terminalThemes = sqliteTable('terminal_themes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  themeData: text('theme_data').notNull(),
  createdBy: text('created_by'),
})

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  layoutData: text('layout_data').notNull(),
  userId: text('user_id'),
})

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorId: text('actor_id'),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  resourceName: text('resource_name'),
  ipAddress: text('ip_address'),
  details: text('details'),
  severity: text('severity').notNull().default('info'),
  createdAt: text('created_at').notNull(),
})

export const activeSessions = sqliteTable('active_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  hostId: text('host_id'),
  sessionType: text('session_type').notNull(),
  startedAt: text('started_at').notNull(),
  lastActivityAt: text('last_activity_at').notNull(),
  isAlive: integer('is_alive', { mode: 'boolean' }).notNull().default(true),
  clientInfo: text('client_info').notNull().default('{}'),
})

export const appSettings = sqliteTable('app_settings', {
  key: text('key').notNull(),
  value: text('value').notNull(),
  userId: text('user_id'),
  updatedAt: text('updated_at').notNull(),
})
