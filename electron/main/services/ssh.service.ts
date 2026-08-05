import { Client, ConnectConfig } from 'ssh2'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { api } from './api.service'
import { getHosts, getCredentials, getDecryptedCredential } from './connections.service'
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
const recordings = new Map<string, { time: number; data: string }[]>()

export const sshEvents = new EventEmitter()

export async function getHostById(hostId: string): Promise<any> {
  const hostsRes = await api.get<{ hosts: any[] }>('/hosts')
  if (!hostsRes.ok) throw new Error('Failed to fetch hosts')

  const host = hostsRes.data.hosts.find((h: any) => h.id === hostId)
  if (!host) throw new Error(`Host not found: ${hostId}`)
  return host
}

/**
 * Build SSH connect config from host + credentials (fetched from sync server)
 */
export async function buildConnectConfig(hostId: string): Promise<ConnectConfig & { hostName: string }> {
  const host = await getHostById(hostId)

  const config: ConnectConfig & { hostName: string } = {
    hostName: host.name,
    host: host.hostname,
    port: host.port || 22,
    username: host.username || 'root',
    readyTimeout: (host.connection_timeout || 30) * 1000,
    keepaliveInterval: host.keepalive_interval ? host.keepalive_interval * 1000 : 0,
  }

  // Fetch credentials for this host
  const creds = await getCredentials(hostId)
  if (creds.length > 0) {
    // Get the first credential's decrypted value from the server
    const decrypted = await getDecryptedCredential(creds[0].id)

    if (decrypted) {
      if (decrypted.type === 'password') {
        config.password = decrypted.value
      } else {
        // Key-based auth
        config.privateKey = decrypted.value
        if (decrypted.passphrase) {
          config.passphrase = decrypted.passphrase
        }
      }
    }
  }

  return config
}

/**
 * Connect SSH Client recursively if jump host is configured
 */
export async function connectClient(hostId: string, client: Client, depth = 0): Promise<void> {
  if (depth > 5) {
    client.emit('error', new Error('Circular jump host connection detected or too many jumps (max 5)'))
    return
  }

  try {
    const host = await getHostById(hostId)

    if (host.jump_host_id) {
      const jumpClient = new Client()

      let isConnecting = true

      const onJumpError = (err: Error) => {
        if (isConnecting) {
          isConnecting = false
          try { jumpClient.end() } catch {}
          client.emit('error', new Error(`Jump host connection error: ${err.message}`))
        }
      }

      const onJumpCloseBeforeReady = () => {
        if (isConnecting) {
          isConnecting = false
          try { jumpClient.end() } catch {}
          client.emit('error', new Error('Jump host connection closed before ready'))
        }
      }

      jumpClient.once('error', onJumpError)
      jumpClient.once('close', onJumpCloseBeforeReady)

      jumpClient.once('ready', () => {
        if (!isConnecting) return

        jumpClient.forwardOut(
          '127.0.0.1', 0,
          host.hostname, host.port || 22,
          async (err, stream) => {
            if (err) {
              isConnecting = false
              try { jumpClient.end() } catch {}
              client.emit('error', new Error(`ForwardOut failed through jump host: ${err.message}`))
              return
            }

            if (!isConnecting) {
              try { stream.end() } catch {}
              try { jumpClient.end() } catch {}
              return
            }

            isConnecting = false
            jumpClient.removeListener('error', onJumpError)
            jumpClient.removeListener('close', onJumpCloseBeforeReady)

            // Setup bidirectional close/error mappings for the lifetime of the connection
            const cleanUp = () => {
              try { jumpClient.end() } catch {}
            }
            client.once('close', cleanUp)
            client.once('error', cleanUp)

            const onJumpClose = () => {
              try { client.end() } catch {}
            }
            jumpClient.once('close', onJumpClose)
            jumpClient.once('error', onJumpClose)

            // Connect target client using the stream
            try {
              const config = await buildConnectConfig(hostId)
              const targetConfig = {
                ...config,
                sock: stream
              }
              client.connect(targetConfig)
            } catch (connErr: any) {
              cleanUp()
              client.emit('error', connErr)
            }
          }
        )
      })

      // Initiate recursive connection to jump host
      connectClient(host.jump_host_id, jumpClient, depth + 1)

    } else {
      const config = await buildConnectConfig(hostId)
      client.connect(config)
    }
  } catch (err: any) {
    client.emit('error', err)
  }
}


/**
 * Spawn an SSH shell session
 */
export async function spawnSSHSession(
  sessionId: string,
  hostId: string,
  cols: number,
  rows: number,
  actorId: string,
  sshShellOptions?: { useZsh?: boolean; zshPlugins?: boolean }
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
        recordings.set(sessionId, [])
        
        client.shell({ term: 'xterm-256color', cols, rows }, { env: { TERM: 'xterm-256color', COLORTERM: 'truecolor' } }, (err, stream) => {
          if (err) {
            session.status = 'error'
            sessions.delete(sessionId)
            reject(err)
            return
          }
          
          session.stream = stream
          let silentStartup = Boolean(sshShellOptions?.useZsh)
          
          stream.on('data', (data: Buffer) => {
            const text = data.toString()
            const rec = recordings.get(sessionId)
            if (rec) rec.push({ time: Date.now(), data: text })
            
            if (!silentStartup) {
              sshEvents.emit('terminal:output', { sessionId, data: text })
            }
          })
          
          stream.stderr.on('data', (data: Buffer) => {
            const text = data.toString()
            const rec = recordings.get(sessionId)
            if (rec) rec.push({ time: Date.now(), data: text })
            if (!silentStartup) {
              sshEvents.emit('terminal:output', { sessionId, data: text })
            }
          })
          
          stream.on('close', () => {
            session.status = 'closed'
            sessions.delete(sessionId)
            sshEvents.emit('terminal:close', { sessionId })
            
            // Upload the session recording to sync server
            const rec = recordings.get(sessionId)
            if (rec && rec.length > 0) {
              api.post(`/audit/recordings/${sessionId}`, { recording: rec }).catch(() => {})
              recordings.delete(sessionId)
            }
          })
          
          // After shell is ready, switch to zsh silently if enabled
          if (sshShellOptions?.useZsh) {
            const cmds: string[] = []
            
            if (sshShellOptions.zshPlugins) {
              cmds.push('[ -d ~/.zsh/zsh-autosuggestions ] || (mkdir -p ~/.zsh && git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions ~/.zsh/zsh-autosuggestions && git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting ~/.zsh/zsh-syntax-highlighting) >/dev/null 2>&1')
              cmds.push('touch ~/.zshrc')
              cmds.push("grep -q zsh-autosuggestions ~/.zshrc 2>/dev/null || echo 'source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh' >> ~/.zshrc")
              cmds.push("grep -q zsh-syntax-highlighting ~/.zshrc 2>/dev/null || echo 'source ~/.zsh/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh' >> ~/.zshrc")
            }
            cmds.push('exec zsh -l')

            const fullCmd = cmds.join('\n')

            // Write startup commands silently into stream
            stream.write(fullCmd + '\n')

            // Un-mute terminal output after 600ms and clear screen cleanly
            setTimeout(() => {
              silentStartup = false
              if (session.status === 'connected') {
                // Clear xterm screen and request fresh prompt
                sshEvents.emit('terminal:output', { sessionId, data: '\x1b[2J\x1b[3J\x1b[H' })
                stream.write('\n')
              }
            }, 600)
          }
          
          // Audit log via server
          api.post('/audit-action', {
            action: 'SSH_CONNECT',
            resourceType: 'host',
            resourceId: hostId,
            resourceName: config.hostName,
            details: { sessionId, host: config.host, port: config.port },
          }).catch(() => {}) // Non-blocking
          
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
      
      connectClient(hostId, client)
      
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
      
      connectClient(hostId, client).catch((err) => {
        clearTimeout(timeout)
        resolve({ success: false, error: err.message })
      })
    } catch (err: unknown) {
      resolve({ success: false, error: (err as Error).message })
    }
  })
}

export function getSSHClientForHost(hostId: string): Client | undefined {
  for (const s of sessions.values()) {
    if (s.hostId === hostId && s.status === 'connected') {
      return s.client
    }
  }
  return undefined
}

