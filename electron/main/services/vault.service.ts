import crypto from 'crypto'
import { safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
const SALT_LENGTH = 32

let cachedKey: Buffer | null = null

function getKeyStorePath(): string {
  return path.join(app.getPath('userData'), '.vault_key')
}

/**
 * Generate and persist the vault encryption key using OS keychain (safeStorage)
 */
export function initializeVault(): void {
  const keyPath = getKeyStorePath()
  
  if (!fs.existsSync(keyPath)) {
    // Generate a new random key
    const key = crypto.randomBytes(KEY_LENGTH)
    const encrypted = safeStorage.encryptString(key.toString('hex'))
    fs.writeFileSync(keyPath, encrypted)
  }
}

/**
 * Get the vault key (decrypted from OS keychain)
 */
function getVaultKey(): Buffer {
  if (cachedKey) return cachedKey
  
  const keyPath = getKeyStorePath()
  
  if (!fs.existsSync(keyPath)) {
    initializeVault()
  }
  
  const encrypted = fs.readFileSync(keyPath)
  const keyHex = safeStorage.decryptString(encrypted)
  cachedKey = Buffer.from(keyHex, 'hex')
  return cachedKey
}

/**
 * Encrypt a plaintext string value
 */
export function encrypt(plaintext: string): string {
  const key = getVaultKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  
  const tag = cipher.getAuthTag()
  
  // Format: iv (hex) : tag (hex) : encrypted (hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt an encrypted string value
 */
export function decrypt(encryptedData: string): string {
  const key = getVaultKey()
  const parts = encryptedData.split(':')
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }
  
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = Buffer.from(parts[2], 'hex')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM
  decipher.setAuthTag(tag)
  
  return decipher.update(encrypted) + decipher.final('utf8')
}

/**
 * Derive a key from a master password (for optional master password mode)
 */
export function deriveKeyFromPassword(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 600000, KEY_LENGTH, 'sha256')
}

/**
 * Hash data for comparison (non-reversible)
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Generate SSH key fingerprint from public key content
 */
export function getKeyFingerprint(publicKeyContent: string): string {
  try {
    const keyBuffer = Buffer.from(publicKeyContent.trim())
    return crypto.createHash('sha256').update(keyBuffer).digest('base64')
  } catch {
    return 'unknown'
  }
}

/**
 * Clear cached vault key (on lock)
 */
export function clearVaultCache(): void {
  cachedKey = null
}
