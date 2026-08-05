import { app, shell } from 'electron'
import https from 'https'

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseNotes: string
  publishedAt?: string
}

export function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/salvinramesh/actionshell/releases/latest',
      headers: {
        'User-Agent': 'ActionShell-App'
      }
    }

    https.get(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            resolve({
              hasUpdate: false,
              currentVersion,
              latestVersion: currentVersion,
              releaseUrl: 'https://github.com/salvinramesh/actionshell/releases',
              releaseNotes: ''
            })
            return
          }

          const json = JSON.parse(data)
          const latestTag = (json.tag_name || '').replace(/^v/, '').trim()
          const releaseUrl = json.html_url || 'https://github.com/salvinramesh/actionshell/releases'
          const releaseNotes = json.body || ''

          const hasUpdate = isNewerVersion(currentVersion, latestTag)

          resolve({
            hasUpdate,
            currentVersion,
            latestVersion: latestTag || currentVersion,
            releaseUrl,
            releaseNotes,
            publishedAt: json.published_at
          })
        } catch {
          resolve({
            hasUpdate: false,
            currentVersion,
            latestVersion: currentVersion,
            releaseUrl: 'https://github.com/salvinramesh/actionshell/releases',
            releaseNotes: ''
          })
        }
      })
    }).on('error', () => {
      resolve({
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: 'https://github.com/salvinramesh/actionshell/releases',
        releaseNotes: ''
      })
    })
  })
}

function isNewerVersion(current: string, latest: string): boolean {
  if (!latest || current === latest) return false
  const cParts = current.split('.').map(Number)
  const lParts = latest.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const c = cParts[i] || 0
    const l = lParts[i] || 0
    if (l > c) return true
    if (l < c) return false
  }
  return false
}

export function openReleaseUrl(url: string) {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url)
  }
}
