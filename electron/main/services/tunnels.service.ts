import net from 'net'
import { Client } from 'ssh2'
import { getSSHClientForHost, connectClient } from './ssh.service'

export interface Tunnel {
  id: string
  hostId: string
  name: string
  type: 'local' | 'remote' | 'dynamic'
  localPort: number
  remoteHost: string
  remotePort: number
  status: 'active' | 'inactive' | 'error'
  error?: string
  connectionsCount: number
  bytesTransferred: number
}

// Active tunnels map
const activeTunnels = new Map<string, {
  tunnel: Tunnel
  server?: net.Server
  client?: Client
  isStandaloneClient?: boolean
}>()

/**
 * Start an SSH tunnel
 */
export async function startTunnel(tunnel: Omit<Tunnel, 'status' | 'connectionsCount' | 'bytesTransferred'>): Promise<void> {
  if (activeTunnels.has(tunnel.id) && activeTunnels.get(tunnel.id)?.tunnel.status === 'active') {
    return
  }

  let client = getSSHClientForHost(tunnel.hostId)
  let isStandaloneClient = false

  // If no active terminal session exists, create a standalone SSH client for tunneling
  if (!client) {
    client = new Client()
    await new Promise<void>((resolve, reject) => {
      client!.on('ready', resolve)
      client!.on('error', reject)
      connectClient(tunnel.hostId, client!).catch(reject)
    })
    isStandaloneClient = true
  }

  const tunnelInfo: Tunnel = {
    ...tunnel,
    status: 'active',
    connectionsCount: 0,
    bytesTransferred: 0
  }

  activeTunnels.set(tunnel.id, { tunnel: tunnelInfo, client, isStandaloneClient })

  try {
    if (tunnel.type === 'local') {
      await startLocalTunnel(tunnel.id, client, tunnel.localPort, tunnel.remoteHost, tunnel.remotePort)
    } else if (tunnel.type === 'remote') {
      await startRemoteTunnel(tunnel.id, client, tunnel.remotePort, tunnel.remoteHost, tunnel.localPort)
    } else if (tunnel.type === 'dynamic') {
      await startDynamicTunnel(tunnel.id, client, tunnel.localPort)
    }
  } catch (err: any) {
    tunnelInfo.status = 'error'
    tunnelInfo.error = err.message || 'Failed to start tunnel'
    if (isStandaloneClient && client) {
      client.end()
    }
    throw err
  }
}

/**
 * Stop an SSH tunnel
 */
export async function stopTunnel(tunnelId: string): Promise<void> {
  const active = activeTunnels.get(tunnelId)
  if (!active) return

  // Close TCP server if it exists (local & dynamic)
  if (active.server) {
    await new Promise<void>((resolve) => active.server!.close(() => resolve()))
  }

  // If it's a remote tunnel, cancel the forwardIn
  if (active.tunnel.type === 'remote' && active.client) {
    try {
      await new Promise<void>((resolve, reject) => {
        active.client!.unforwardIn('0.0.0.0', active.tunnel.remotePort, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    } catch {}
  }

  // End connection if it was a standalone client
  if (active.isStandaloneClient && active.client) {
    active.client.end()
  }

  activeTunnels.delete(tunnelId)
}

/**
 * List all configured/active tunnels
 */
export function listTunnels(): Tunnel[] {
  return Array.from(activeTunnels.values()).map(x => x.tunnel)
}

/**
 * Close all tunnels on app shutdown
 */
export function closeAllTunnels(): void {
  for (const id of activeTunnels.keys()) {
    stopTunnel(id).catch(() => {})
  }
}

// ==========================================
// Helper functions for tunnel types
// ==========================================

async function startLocalTunnel(
  tunnelId: string,
  client: Client,
  localPort: number,
  remoteHost: string,
  remotePort: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      const active = activeTunnels.get(tunnelId)
      if (!active) return

      active.tunnel.connectionsCount++

      client.forwardOut(
        socket.remoteAddress || '127.0.0.1',
        socket.remotePort || 0,
        remoteHost,
        remotePort,
        (err, stream) => {
          if (err) {
            socket.destroy()
            return
          }

          socket.on('data', (chunk: Buffer) => {
            if (active) active.tunnel.bytesTransferred += chunk.length
          })
          stream.on('data', (chunk: Buffer) => {
            if (active) active.tunnel.bytesTransferred += chunk.length
          })

          socket.pipe(stream).pipe(socket)
        }
      )

      socket.on('close', () => {
        if (active) active.tunnel.connectionsCount = Math.max(0, active.tunnel.connectionsCount - 1)
      })
      socket.on('error', () => {})
    })

    server.on('error', (err) => {
      reject(err)
    })

    server.listen(localPort, '127.0.0.1', () => {
      const active = activeTunnels.get(tunnelId)
      if (active) active.server = server
      resolve()
    })
  })
}

async function startRemoteTunnel(
  tunnelId: string,
  client: Client,
  remotePort: number,
  localHost: string,
  localPort: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.forwardIn('0.0.0.0', remotePort, (err) => {
      if (err) return reject(err)

      // Listen for incoming connections on the remote port
      client.on('tcp connection', (info: any, accept: any, rejectConn: any) => {
        // Only handle if the destination port matches this tunnel
        if (info.destPort !== remotePort) return

        const active = activeTunnels.get(tunnelId)
        if (!active) {
          rejectConn()
          return
        }

        active.tunnel.connectionsCount++
        const stream = accept()

        const localSocket = net.connect(localPort, localHost, () => {
          stream.pipe(localSocket).pipe(stream)
        })

        localSocket.on('data', (chunk: Buffer) => {
          active.tunnel.bytesTransferred += chunk.length
        })
        stream.on('data', (chunk: Buffer) => {
          active.tunnel.bytesTransferred += chunk.length
        })

        localSocket.on('close', () => {
          active.tunnel.connectionsCount = Math.max(0, active.tunnel.connectionsCount - 1)
        })

        localSocket.on('error', () => {
          stream.destroy()
        })
      })

      resolve()
    })
  })
}

async function startDynamicTunnel(
  tunnelId: string,
  client: Client,
  localPort: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      const active = activeTunnels.get(tunnelId)
      if (!active) return

      active.tunnel.connectionsCount++
      let state = 0 // 0: Auth exchange, 1: Request parsing

      socket.on('data', (chunk: Buffer) => {
        try {
          if (state === 0) {
            // Handshake greeting: SOCKS version (0x05)
            if (chunk[0] !== 0x05) {
              socket.destroy()
              return
            }
            // Response: version 5, no auth required (0x00)
            socket.write(Buffer.from([0x05, 0x00]))
            state = 1
          } else if (state === 1) {
            // Connect request: SOCKS version (0x05), command CONNECT (0x01)
            if (chunk[0] !== 0x05 || chunk[1] !== 0x01) {
              socket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0])) // Command not supported
              socket.destroy()
              return
            }

            const atyp = chunk[3]
            let dstAddr = ''
            let offset = 4

            if (atyp === 0x01) { // IPv4
              dstAddr = `${chunk[4]}.${chunk[5]}.${chunk[6]}.${chunk[7]}`
              offset = 8
            } else if (atyp === 0x03) { // Domain name
              const len = chunk[4]
              dstAddr = chunk.toString('utf8', 5, 5 + len)
              offset = 5 + len
            } else if (atyp === 0x04) { // IPv6
              dstAddr = chunk.slice(4, 20).toString('hex') // raw representation
              offset = 20
            } else {
              socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0])) // Addr type not supported
              socket.destroy()
              return
            }

            const dstPort = chunk.readUInt16BE(offset)

            client.forwardOut(
              socket.remoteAddress || '127.0.0.1',
              socket.remotePort || 0,
              dstAddr,
              dstPort,
              (err, stream) => {
                if (err) {
                  socket.write(Buffer.from([0x05, 0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0])) // Host unreachable
                  socket.destroy()
                  return
                }

                // Success reply: SOCKS version (0x05), status succeeded (0x00)
                socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))

                socket.on('data', (c: Buffer) => {
                  active.tunnel.bytesTransferred += c.length
                })
                stream.on('data', (c: Buffer) => {
                  active.tunnel.bytesTransferred += c.length
                })

                socket.pipe(stream).pipe(socket)
              }
            )
          }
        } catch {
          socket.destroy()
        }
      })

      socket.on('close', () => {
        if (active) active.tunnel.connectionsCount = Math.max(0, active.tunnel.connectionsCount - 1)
      })

      socket.on('error', () => {})
    })

    server.on('error', (err) => {
      reject(err)
    })

    server.listen(localPort, '127.0.0.1', () => {
      const active = activeTunnels.get(tunnelId)
      if (active) active.server = server
      resolve()
    })
  })
}
