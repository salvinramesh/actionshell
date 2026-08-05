import { create } from 'zustand'

const DEFAULT_COMMANDS = [
  'systemctl status',
  'systemctl restart',
  'systemctl stop',
  'docker ps -a',
  'docker-compose up -d',
  'docker logs -f',
  'kubectl get pods -A',
  'git status',
  'git pull origin main',
  'git log -n 10 --oneline',
  'sudo apt update && sudo apt upgrade -y',
  'tail -f /var/log/syslog',
  'netstat -tulpn',
  'journalctl -xe -u',
  'htop',
  'df -h',
  'free -h',
  'ls -la',
  'cat /etc/os-release'
]

interface AutoSuggestStore {
  history: string[]
  addCommand: (cmd: string) => void
  getSuggestion: (input: string) => string | null
}

const STORAGE_KEY = 'actionshell_command_history'

function loadHistory(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Array.from(new Set([...parsed, ...DEFAULT_COMMANDS]))
      }
    }
  } catch {}
  return DEFAULT_COMMANDS
}

export const useAutoSuggestStore = create<AutoSuggestStore>((set, get) => ({
  history: loadHistory(),

  addCommand: (cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed || trimmed.length < 2) return

    set(s => {
      // Keep most recent commands first, max 300 unique
      const next = Array.from(new Set([trimmed, ...s.history])).slice(0, 300)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return { history: next }
    })
  },

  getSuggestion: (input: string) => {
    const trimmed = input.trim()
    if (!trimmed || trimmed.length < 2) return null

    const { history } = get()
    const match = history.find(c => c.startsWith(trimmed) && c !== trimmed)
    return match || null
  }
}))
