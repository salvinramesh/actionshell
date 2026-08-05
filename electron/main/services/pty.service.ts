import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import os from 'os'

import fs from 'fs'

interface PTYSession {
  id: string
  process: pty.IPty
  status: 'active' | 'closed'
}

const ptySessions = new Map<string, PTYSession>()
export const ptyEvents = new EventEmitter()

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return 'powershell.exe'
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
  const shellPath = shell || getDefaultShell()
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    SHELL: shellPath,
    LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
    LANG: process.env.LANG || 'en_US.UTF-8'
  }
  
  const process_ = pty.spawn(shellPath, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.homedir(),
    env: env as Record<string, string>
  })
  
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
