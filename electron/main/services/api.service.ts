/**
 * API Service — central HTTP client for the ActionShell sync server.
 * All desktop ↔ server communication goes through here.
 */

const API_BASE = process.env.MAIN_VITE_SYNC_SERVER_URL || process.env.VITE_SYNC_SERVER_URL || 'https://actionshell.actionfi.com/api'

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const url = `${API_BASE}${path}`

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await res.json().catch(() => ({}))

    return { ok: res.ok, status: res.status, data: data as T }
  } catch (err: unknown) {
    console.error(`API ${method} ${path} failed:`, err)
    return {
      ok: false,
      status: 0,
      data: { error: 'Network error — cannot reach sync server' } as T,
    }
  }
}

export const api = {
  get: <T = unknown>(path: string) => request<T>('GET', path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
}
