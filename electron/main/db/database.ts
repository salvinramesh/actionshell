import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'

let db: ReturnType<typeof drizzle>
let sqliteDb: Database.Database

export function getDatabase() {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'actionshell.db')
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    
    sqliteDb = new Database(dbPath)
    
    // Enable WAL mode for better performance
    sqliteDb.pragma('journal_mode = WAL')
    sqliteDb.pragma('foreign_keys = ON')
    sqliteDb.pragma('synchronous = NORMAL')
    
    db = drizzle(sqliteDb, { schema })
    
    // Run migrations
    initializeSchema(sqliteDb)
  }
  return db
}

export function getRawDb(): Database.Database {
  if (!sqliteDb) getDatabase()
  return sqliteDb
}

function initializeSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'standard',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_locked INTEGER NOT NULL DEFAULT 0,
      mfa_secret TEXT,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      last_login_at TEXT,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      user_id TEXT REFERENCES users(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_key_user ON app_settings(key, user_id);

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS host_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES host_groups(id),
      color TEXT,
      icon TEXT,
      created_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ssh_hosts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hostname TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT,
      auth_type TEXT NOT NULL DEFAULT 'password',
      group_id TEXT REFERENCES host_groups(id),
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      jump_host_id TEXT REFERENCES ssh_hosts(id),
      keepalive_interval INTEGER,
      connection_timeout INTEGER NOT NULL DEFAULT 30,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL REFERENCES ssh_hosts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      label TEXT,
      encrypted_value TEXT NOT NULL,
      passphrase_encrypted TEXT,
      fingerprint TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_permissions (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL REFERENCES ssh_hosts(id) ON DELETE CASCADE,
      grantee_type TEXT NOT NULL,
      grantee_id TEXT NOT NULL,
      can_connect INTEGER NOT NULL DEFAULT 1,
      can_sftp INTEGER NOT NULL DEFAULT 1,
      can_tunnel INTEGER NOT NULL DEFAULT 0,
      is_temporary INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      granted_by TEXT REFERENCES users(id),
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ssh_tunnels (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL REFERENCES ssh_hosts(id) ON DELETE CASCADE,
      name TEXT,
      type TEXT NOT NULL DEFAULT 'local',
      local_port INTEGER NOT NULL,
      remote_host TEXT NOT NULL,
      remote_port INTEGER NOT NULL,
      is_auto_start INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      command TEXT NOT NULL,
      description TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      variables TEXT NOT NULL DEFAULT '[]',
      scope TEXT NOT NULL DEFAULT 'personal',
      team_id TEXT REFERENCES teams(id),
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS terminal_themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      theme_data TEXT NOT NULL,
      created_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      layout_data TEXT NOT NULL,
      user_id TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT REFERENCES users(id),
      actor_email TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      resource_name TEXT,
      ip_address TEXT,
      details TEXT,
      severity TEXT NOT NULL DEFAULT 'info',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS active_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      host_id TEXT REFERENCES ssh_hosts(id),
      session_type TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_alive INTEGER NOT NULL DEFAULT 1,
      client_info TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_ssh_hosts_group ON ssh_hosts(group_id);
    CREATE INDEX IF NOT EXISTS idx_ssh_hosts_created_by ON ssh_hosts(created_by);
    CREATE INDEX IF NOT EXISTS idx_credentials_host ON credentials(host_id);
    CREATE INDEX IF NOT EXISTS idx_server_permissions_host ON server_permissions(host_id);
    CREATE INDEX IF NOT EXISTS idx_server_permissions_grantee ON server_permissions(grantee_id, grantee_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_snippets_created_by ON snippets(created_by);
    
    INSERT OR IGNORE INTO terminal_themes (id, name, is_builtin, theme_data) VALUES
    ('actionshell-dark', 'ActionShell Dark', 1, '{"background":"#0A0E1A","foreground":"#CDD6F4","cursor":"#00D4FF","cursorAccent":"#0A0E1A","selectionBackground":"#1E3A5F","black":"#181825","red":"#F38BA8","green":"#A6E3A1","yellow":"#F9E2AF","blue":"#89B4FA","magenta":"#CBA6F7","cyan":"#00D4FF","white":"#BAC2DE","brightBlack":"#585B70","brightRed":"#F38BA8","brightGreen":"#A6E3A1","brightYellow":"#F9E2AF","brightBlue":"#89B4FA","brightMagenta":"#CBA6F7","brightCyan":"#94E2D5","brightWhite":"#A6ADC8"}'),
    ('monokai', 'Monokai', 1, '{"background":"#272822","foreground":"#F8F8F2","cursor":"#F8F8F2","cursorAccent":"#272822","selectionBackground":"#49483E","black":"#272822","red":"#F92672","green":"#A6E22E","yellow":"#F4BF75","blue":"#66D9EF","magenta":"#AE81FF","cyan":"#A1EFE4","white":"#F8F8F2","brightBlack":"#75715E","brightRed":"#F92672","brightGreen":"#A6E22E","brightYellow":"#F4BF75","brightBlue":"#66D9EF","brightMagenta":"#AE81FF","brightCyan":"#A1EFE4","brightWhite":"#F9F8F5"}'),
    ('nord', 'Nord', 1, '{"background":"#2E3440","foreground":"#D8DEE9","cursor":"#D8DEE9","cursorAccent":"#2E3440","selectionBackground":"#4C566A","black":"#3B4252","red":"#BF616A","green":"#A3BE8C","yellow":"#EBCB8B","blue":"#81A1C1","magenta":"#B48EAD","cyan":"#88C0D0","white":"#E5E9F0","brightBlack":"#4C566A","brightRed":"#BF616A","brightGreen":"#A3BE8C","brightYellow":"#EBCB8B","brightBlue":"#81A1C1","brightMagenta":"#B48EAD","brightCyan":"#8FBCBB","brightWhite":"#ECEFF4"}'),
    ('solarized-dark', 'Solarized Dark', 1, '{"background":"#002B36","foreground":"#839496","cursor":"#839496","cursorAccent":"#002B36","selectionBackground":"#073642","black":"#073642","red":"#DC322F","green":"#859900","yellow":"#B58900","blue":"#268BD2","magenta":"#D33682","cyan":"#2AA198","white":"#EEE8D5","brightBlack":"#002B36","brightRed":"#CB4B16","brightGreen":"#586E75","brightYellow":"#657B83","brightBlue":"#839496","brightMagenta":"#6C71C4","brightCyan":"#93A1A1","brightWhite":"#FDF6E3"}');
  `)
}

export function closeDatabase() {
  if (sqliteDb) {
    sqliteDb.close()
  }
}
