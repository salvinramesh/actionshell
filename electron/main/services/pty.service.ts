import { EventEmitter } from 'events'
import os from 'os'
import fs from 'fs'
import path from 'path'

// Lazy-load node-pty — if the native module isn't compiled for this
// Electron version the import throws at require-time.  We catch that
// here so the rest of the app keeps working (SSH still works).
let pty: typeof import('node-pty') | null = null
let ptyLoadError: string | null = null
try {
  pty = require('node-pty')
} catch (err: any) {
  ptyLoadError = err.message || 'Failed to load node-pty native module'
  console.error('[pty.service] node-pty failed to load:', ptyLoadError)
}

interface PTYSession {
  id: string
  process: import('node-pty').IPty
  status: 'active' | 'closed'
}

const ptySessions = new Map<string, PTYSession>()
export const ptyEvents = new EventEmitter()

/**
 * Resolve the best available shell on Windows.
 * Checks: powershell.exe → pwsh.exe (PS7) → cmd.exe
 */
function getWindowsShell(): string {
  // PowerShell 5 (ships with every Windows 10/11)
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  const ps5 = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  if (fs.existsSync(ps5)) return ps5

  // PowerShell 7+ (pwsh.exe)
  const pwshLocations = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
    'pwsh.exe',  // if on PATH
  ]
  for (const p of pwshLocations) {
    try { if (fs.existsSync(p)) return p } catch {}
  }

  // Fallback: cmd.exe
  return path.join(systemRoot, 'System32', 'cmd.exe')
}

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return getWindowsShell()
  }

  // Prioritize Zsh on Unix/Linux/macOS systems
  const candidateZshPaths = ['/bin/zsh', '/usr/bin/zsh', '/usr/local/bin/zsh']
  for (const zpath of candidateZshPaths) {
    if (fs.existsSync(zpath)) {
      return zpath
    }
  }

  if (process.env.SHELL && process.env.SHELL.includes('zsh')) {
    return process.env.SHELL
  }

  return process.env.SHELL || '/bin/bash'
}

/**
 * Spawn a local PTY session
 */
export function spawnPTY(
  sessionId: string,
  shell?: string,
  cols = 80,
  rows = 24
): void {
  // Check if node-pty loaded successfully
  if (!pty) {
    const errMsg = ptyLoadError || 'node-pty native module is not available'
    ptyEvents.emit('terminal:output', {
      sessionId,
      data: `\r\n\x1b[31m[Local Terminal Error]\x1b[0m ${errMsg}\r\n\x1b[90mThis usually means the native module was not compiled for this Electron version.\r\nSSH terminal connections still work normally.\x1b[0m\r\n`
    })
    // Emit error event so UI shows error state
    ptyEvents.emit('terminal:error', { sessionId, error: errMsg })
    throw new Error(errMsg)
  }

  const shellPath = shell || getDefaultShell()
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    SHELL: shellPath,
    LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
    LANG: process.env.LANG || 'en_US.UTF-8'
  }

  let process_: import('node-pty').IPty

  try {
    process_ = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: os.homedir(),
      env: env as Record<string, string>
    })
  } catch (spawnErr: any) {
    // If the requested shell failed, try fallback shells
    const fallbacks = process.platform === 'win32'
      ? [getWindowsShell(), 'cmd.exe']
      : ['/bin/bash', '/bin/sh']

    let fallbackProcess: import('node-pty').IPty | null = null
    for (const fb of fallbacks) {
      if (fb === shellPath) continue  // skip the one that already failed
      try {
        fallbackProcess = pty.spawn(fb, [], {
          name: 'xterm-256color',
          cols,
          rows,
          cwd: os.homedir(),
          env: { ...env, SHELL: fb } as Record<string, string>
        })
        break
      } catch {}
    }

    if (!fallbackProcess) {
      const errMsg = `Failed to spawn shell "${shellPath}": ${spawnErr.message}`
      ptyEvents.emit('terminal:output', {
        sessionId,
        data: `\r\n\x1b[31m[Local Terminal Error]\x1b[0m ${errMsg}\r\n`
      })
      throw new Error(errMsg)
    }

    process_ = fallbackProcess
  }

  const session: PTYSession = {
    id: sessionId,
    process: process_,
    status: 'active'
  }

  ptySessions.set(sessionId, session)

  process_.onData((data: string) => {
    ptyEvents.emit('terminal:output', { sessionId, data })
  })

  process_.onExit(({ exitCode }) => {
    session.status = 'closed'
    ptySessions.delete(sessionId)
    ptyEvents.emit('terminal:close', { sessionId, exitCode })
  })
}

/**
 * Send input to PTY
 */
export function sendPTYInput(sessionId: string, data: string): void {
  const session = ptySessions.get(sessionId)
  if (session?.status === 'active') {
    session.process.write(data)
  }
}

/**
 * Resize PTY
 */
export function resizePTY(sessionId: string, cols: number, rows: number): void {
  const session = ptySessions.get(sessionId)
  if (session?.status === 'active') {
    session.process.resize(cols, rows)
  }
}

/**
 * Kill PTY session
 */
export function killPTY(sessionId: string): void {
  const session = ptySessions.get(sessionId)
  if (session) {
    try { session.process.kill() } catch {}
    session.status = 'closed'
    ptySessions.delete(sessionId)
  }
}

/**
 * Kill all PTY sessions
 */
export function killAllPTY(): void {
  for (const [id] of ptySessions) {
    killPTY(id)
  }
}
