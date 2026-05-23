import { Client, SFTPWrapper } from 'ssh2'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { api } from './api.service'
import { getCredentials, getDecryptedCredential } from './connections.service'
import { writeAuditLog } from './audit.service'
import type { SFTPEntry } from '../../../shared/types'

interface SFTPSession {
  id: string
  hostId: string
  client: Client
  sftp: SFTPWrapper
  currentPath: string
}

const sftpSessions = new Map<string, SFTPSession>()
export const sftpEvents = new EventEmitter()

async function buildConnectConfig(hostId: string): Promise<any> {
  const hostsRes = await api.get<{ hosts: any[] }>('/hosts')
  if (!hostsRes.ok) throw new Error('Failed to fetch hosts')

  const host = hostsRes.data.hosts.find((h: any) => h.id === hostId)
  if (!host) throw new Error('Host not found')
  
  const config: any = {
    host: host.hostname,
    port: host.port || 22,
    username: host.username || 'root',
    readyTimeout: 30000,
  }
  
  const creds = await getCredentials(hostId)
  if (creds.length > 0) {
    const decrypted = await getDecryptedCredential(creds[0].id)
    if (decrypted) {
      if (decrypted.type === 'password') {
        config.password = decrypted.value
      } else {
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
 * Open an SFTP session
 */
export async function connectSFTP(sessionId: string, hostId: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const config = await buildConnectConfig(hostId)
      const client = new Client()
      
      client.on('ready', () => {
        client.sftp((err, sftp) => {
          if (err) {
            client.end()
            reject(err)
            return
          }
          
          const session: SFTPSession = {
            id: sessionId,
            hostId,
            client,
            sftp,
            currentPath: '/'
          }
          
          sftpSessions.set(sessionId, session)
          
          writeAuditLog({
            action: 'SFTP_CONNECT',
            resourceType: 'host',
            resourceId: hostId,
            details: { sessionId },
            severity: 'info'
          })
          
          resolve()
        })
      })
      
      client.on('error', reject)
      client.connect(config)
      
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * List directory contents
 */
export async function listDirectory(sessionId: string, remotePath: string): Promise<SFTPEntry[]> {
  const session = sftpSessions.get(sessionId)
  if (!session) throw new Error('SFTP session not found')
  
  return new Promise((resolve, reject) => {
    session.sftp.readdir(remotePath, (err, list) => {
      if (err) return reject(err)
      
      const entries: SFTPEntry[] = list.map(item => {
        const mode = item.attrs.mode || 0
        const isDir = (mode & 0o170000) === 0o040000
        const isSymlink = (mode & 0o170000) === 0o120000
        
        return {
          name: item.filename,
          path: path.posix.join(remotePath, item.filename),
          type: isDir ? 'directory' : isSymlink ? 'symlink' : 'file',
          size: item.attrs.size || 0,
          permissions: mode & 0o777,
          owner: item.attrs.uid || 0,
          group: item.attrs.gid || 0,
          modifiedAt: new Date((item.attrs.mtime || 0) * 1000).toISOString(),
          isHidden: item.filename.startsWith('.')
        }
      })
      
      resolve(entries.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1
        if (a.type !== 'directory' && b.type === 'directory') return 1
        return a.name.localeCompare(b.name)
      }))
    })
  })
}

/**
 * Upload a file
 */
export async function uploadFile(
  sessionId: string,
  localPath: string,
  remotePath: string,
  onProgress?: (transferred: number, total: number) => void
): Promise<void> {
  const session = sftpSessions.get(sessionId)
  if (!session) throw new Error('SFTP session not found')
  
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(localPath)
    const total = stat.size
    let transferred = 0
    
    const readStream = fs.createReadStream(localPath)
    const writeStream = session.sftp.createWriteStream(remotePath)
    
    readStream.on('data', (chunk: string | Buffer) => {
      transferred += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
      onProgress?.(transferred, total)
      sftpEvents.emit('transfer:progress', { sessionId, transferred, total, remotePath })
    })
    
    writeStream.on('close', () => {
      writeAuditLog({
        action: 'SFTP_UPLOAD',
        resourceType: 'host',
        resourceId: session.hostId,
        details: { remotePath, size: total },
        severity: 'info'
      })
      resolve()
    })
    
    writeStream.on('error', reject)
    readStream.on('error', reject)
    readStream.pipe(writeStream)
  })
}

/**
 * Download a file
 */
export async function downloadFile(
  sessionId: string,
  remotePath: string,
  localPath: string,
  onProgress?: (transferred: number, total: number) => void
): Promise<void> {
  const session = sftpSessions.get(sessionId)
  if (!session) throw new Error('SFTP session not found')
  
  return new Promise((resolve, reject) => {
    session.sftp.stat(remotePath, (err, stat) => {
      if (err) return reject(err)
      const total = stat.size
      let transferred = 0
      
      const readStream = session.sftp.createReadStream(remotePath)
      const writeStream = fs.createWriteStream(localPath)
      
      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        onProgress?.(transferred, total)
        sftpEvents.emit('transfer:progress', { sessionId, transferred, total, remotePath })
      })
      
      writeStream.on('close', () => {
        writeAuditLog({
          action: 'SFTP_DOWNLOAD',
          resourceType: 'host',
          resourceId: session.hostId,
          details: { remotePath, size: total },
          severity: 'info'
        })
        resolve()
      })
      
      readStream.on('error', reject)
      writeStream.on('error', reject)
      readStream.pipe(writeStream)
    })
  })
}

/**
 * Delete a file or empty directory
 */
export async function deleteEntry(sessionId: string, remotePath: string, isDir: boolean): Promise<void> {
  const session = sftpSessions.get(sessionId)
  if (!session) throw new Error('SFTP session not found')
  
  return new Promise((resolve, reject) => {
    if (isDir) {
      session.sftp.rmdir(remotePath, (err) => err ? reject(err) : resolve())
    } else {
      session.sftp.unlink(remotePath, (err) => err ? reject(err) : resolve())
    }
  })
}

/**
 * Rename / move
 */
export async function renameEntry(sessionId: string, oldPath: string, newPath: string): Promise<void> {
  const session = sftpSessions.get(sessionId)
  if (!session) throw new Error('SFTP session not found')
  
  return new Promise((resolve, reject) => {
    session.sftp.rename(oldPath, newPath, (err) => err ? reject(err) : resolve())
  })
}

/**
 * Create directory
 */
export async function makeDirectory(sessionId: string, remotePath: string): Promise<void> {
  const session = sftpSessions.get(sessionId)
  if (!session) throw new Error('SFTP session not found')
  
  return new Promise((resolve, reject) => {
    session.sftp.mkdir(remotePath, (err) => err ? reject(err) : resolve())
  })
}

/**
 * Change permissions (chmod)
 */
export async function changePermissions(sessionId: string, remotePath: string, mode: number): Promise<void> {
  const session = sftpSessions.get(sessionId)
  if (!session) throw new Error('SFTP session not found')
  
  return new Promise((resolve, reject) => {
    session.sftp.chmod(remotePath, mode, (err) => err ? reject(err) : resolve())
  })
}

/**
 * Change ownership (chown)
 */
export async function changeOwnership(sessionId: string, remotePath: string, uid: number, gid: number): Promise<void> {
  const session = sftpSessions.get(sessionId)
  if (!session) throw new Error('SFTP session not found')
  
  return new Promise((resolve, reject) => {
    session.sftp.chown(remotePath, uid, gid, (err) => err ? reject(err) : resolve())
  })
}

/**
 * Disconnect SFTP session
 */
export async function disconnectSFTP(sessionId: string): Promise<void> {
  const session = sftpSessions.get(sessionId)
  if (session) {
    try {
      session.sftp.end()
      session.client.end()
    } catch {}
    sftpSessions.delete(sessionId)
  }
}

/**
 * Close all SFTP sessions
 */
export function closeAllSFTPSessions(): void {
  for (const [id] of sftpSessions) {
    disconnectSFTP(id).catch(() => {})
  }
}
