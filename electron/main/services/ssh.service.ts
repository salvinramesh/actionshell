import { Client, ConnectConfig } from 'ssh2'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { getRawDb } from '../db/database'
import { decrypt } from './vault.service'
import { writeAuditLog } from './audit.service'
import type { SSHHost } from '../../../shared/types'

export interface SSHSession {
  id: string
  hostId: string
  client: Client
  stream: any
  status: 'connecting' | 'connected' | 'error' | 'closed'
  cols: number
  rows: number
}

// Active SSH sessions
const sessions = new Map<string, SSHSession>()

export const sshEvents = new EventEmitter()

/**
 * Build SSH connect config from host + credentials
 */
async function buildConnectConfig(hostId: string): Promise<ConnectConfig & { hostName: string }> {
  const db = getRawDb()
  
  const host = db.prepare('SELECT * FROM ssh_hosts WHERE id = ?').get(hostId) as any
  if (!host) throw new Error('Host not found')
  
  const cred = db.prepare('SELECT * FROM credentials WHERE host_id = ? LIMIT 1').get(hostId) as any
  
  const config: ConnectConfig & { hostName: string } = {
    hostName: host.name,
    host: host.hostname,
    port: host.port || 22,
    username: host.username || 'root',
    readyTimeout: (host.connection_timeout || 30) * 1000,
    keepaliveInterval: host.keepalive_interval ? host.keepalive_interval * 1000 : 0,
  }
  
  if (cred) {
    if (cred.type === 'password') {
      config.password = decrypt(cred.encrypted_value)
    } else {
      // Key-based auth
      const privateKey = decrypt(cred.encrypted_value)
      config.privateKey = privateKey
      if (cred.passphrase_encrypted) {
        config.passphrase = decrypt(cred.passphrase_encrypted)
      }
    }
  }
  
  // Jump host (proxy)
  if (host.jump_host_id) {
    // TODO: ProxyJump implementation
  }
  
  return config
}

/**
 * Spawn an SSH shell session
 */
export async function spawnSSHSession(
  sessionId: string,
  hostId: string,
  cols: number,
  rows: number,
  actorId: string
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const config = await buildConnectConfig(hostId)
      
      const client = new Client()
      
      const session: SSHSession = {
        id: sessionId,
        hostId,
        client,
        stream: null,
        status: 'connecting',
        cols,
        rows
      }
      
      sessions.set(sessionId, session)
      
      client.on('ready', () => {
        session.status = 'connected'
        
        client.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
          if (err) {
            session.status = 'error'
            sessions.delete(sessionId)
            reject(err)
            return
          }
          
          session.stream = stream
          
          stream.on('data', (data: Buffer) => {
            sshEvents.emit('terminal:output', { sessionId, data: data.toString() })
          })
          
          stream.stderr.on('data', (data: Buffer) => {
            sshEvents.emit('terminal:output', { sessionId, data: data.toString() })
          })
          
          stream.on('close', () => {
            session.status = 'closed'
            sessions.delete(sessionId)
            sshEvents.emit('terminal:close', { sessionId })
          })
          
          writeAuditLog({
            actorId,
            action: 'SSH_CONNECT',
            resourceType: 'host',
            resourceId: hostId,
            resourceName: config.hostName,
            details: { sessionId, host: config.host, port: config.port },
            severity: 'info'
          })
          
          resolve()
        })
      })
      
      client.on('error', (err) => {
        session.status = 'error'
        sessions.delete(sessionId)
        sshEvents.emit('terminal:error', { sessionId, error: err.message })
        reject(err)
      })
      
      client.on('close', () => {
        if (session.status !== 'closed') {
          session.status = 'closed'
          sessions.delete(sessionId)
          sshEvents.emit('terminal:close', { sessionId })
        }
      })
      
      client.connect(config)
      
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Send input data to an SSH session
 */
export function sendInput(sessionId: string, data: string): void {
  const session = sessions.get(sessionId)
  if (session?.stream && session.status === 'connected') {
    session.stream.write(data)
  }
}

/**
 * Resize terminal
 */
export function resizeTerminal(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId)
  if (session?.stream && session.status === 'connected') {
    session.stream.setWindow(rows, cols)
    session.cols = cols
    session.rows = rows
  }
}

/**
 * Close an SSH session
 */
export async function closeSession(sessionId: string, actorId?: string): Promise<void> {
  const session = sessions.get(sessionId)
  if (session) {
    const hostId = session.hostId
    try {
      session.stream?.end()
      session.client.end()
    } catch {}
    session.status = 'closed'
    sessions.delete(sessionId)
    
    if (actorId) {
      await writeAuditLog({
        actorId,
        action: 'SSH_DISCONNECT',
        resourceType: 'host',
        resourceId: hostId,
        details: { sessionId },
        severity: 'info'
      })
    }
  }
}

/**
 * Close all sessions (on app quit)
 */
export function closeAllSessions(): void {
  for (const [id] of sessions) {
    closeSession(id).catch(() => {})
  }
}

/**
 * Get active session IDs
 */
export function getActiveSessions(): { sessionId: string; hostId: string; status: string }[] {
  return Array.from(sessions.entries()).map(([id, s]) => ({
    sessionId: id,
    hostId: s.hostId,
    status: s.status
  }))
}

/**
 * Test SSH connection (connect + disconnect immediately)
 */
export async function testConnection(hostId: string): Promise<{ success: boolean; error?: string; latency?: number }> {
  return new Promise(async (resolve) => {
    try {
      const config = await buildConnectConfig(hostId)
      const client = new Client()
      const start = Date.now()
      
      const timeout = setTimeout(() => {
        client.end()
        resolve({ success: false, error: 'Connection timed out' })
      }, 15000)
      
      client.on('ready', () => {
        clearTimeout(timeout)
        const latency = Date.now() - start
        client.end()
        resolve({ success: true, latency })
      })
      
      client.on('error', (err) => {
        clearTimeout(timeout)
        resolve({ success: false, error: err.message })
      })
      
      client.connect(config)
    } catch (err: unknown) {
      resolve({ success: false, error: (err as Error).message })
    }
  })
}
