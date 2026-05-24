import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { encrypt, decrypt } from './vault.service'

export interface SavedKey {
  id: string
  name: string
  key: string
  passphrase?: string
}

function getSavedKeysFilePath(): string {
  return path.join(app.getPath('userData'), 'saved_keys.json')
}

export function getSavedKeys(): SavedKey[] {
  const filePath = getSavedKeysFilePath()
  if (!fs.existsSync(filePath)) {
    return []
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const encryptedList = JSON.parse(raw) as any[]
    return encryptedList.map(item => ({
      id: item.id,
      name: item.name,
      key: decrypt(item.key),
      passphrase: item.passphrase ? decrypt(item.passphrase) : undefined
    }))
  } catch (err) {
    console.error('Failed to read saved keys:', err)
    return []
  }
}

export function saveKeysList(list: SavedKey[]): void {
  const filePath = getSavedKeysFilePath()
  const encryptedList = list.map(item => ({
    id: item.id,
    name: item.name,
    key: encrypt(item.key),
    passphrase: item.passphrase ? encrypt(item.passphrase) : undefined
  }))
  fs.writeFileSync(filePath, JSON.stringify(encryptedList, null, 2), 'utf8')
}

export function addSavedKey(name: string, key: string, passphrase?: string): SavedKey {
  const list = getSavedKeys()
  const newKey: SavedKey = {
    id: uuidv4(),
    name,
    key,
    passphrase
  }
  list.push(newKey)
  saveKeysList(list)
  return newKey
}

export function deleteSavedKey(id: string): boolean {
  const list = getSavedKeys()
  const index = list.findIndex(k => k.id === id)
  if (index === -1) return false
  list.splice(index, 1)
  saveKeysList(list)
  return true
}
