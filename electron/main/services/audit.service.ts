import { api } from './api.service'
import type { AuditSeverity } from '../../../shared/types'

interface AuditEntry {
  actorId?: string | null
  actorEmail?: string | null
  action: string
  resourceType?: string | null
  resourceId?: string | null
  resourceName?: string | null
  ipAddress?: string | null
  details?: Record<string, unknown> | null
  severity?: AuditSeverity
}

/**
 * Write audit log — now a no-op on the desktop side.
 * All audit logging is handled server-side by the API routes.
 * This stub exists so existing callers don't break.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  // Audit logs are now written server-side automatically
  // when API endpoints are called. This is a no-op stub.
}

/**
 * Get audit logs from the sync server
 */
export async function getAuditLogs(filters: {
  actorId?: string
  action?: string
  resourceType?: string
  severity?: AuditSeverity
  from?: string
  to?: string
  limit?: number
  offset?: number
}) {
  const params = new URLSearchParams()
  if (filters.actorId) params.set('actorId', filters.actorId)
  if (filters.action) params.set('action', filters.action)
  if (filters.resourceType) params.set('resourceType', filters.resourceType)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.offset) {
    const page = Math.floor(filters.offset / (filters.limit || 100)) + 1
    params.set('page', String(page))
  }

  const qs = params.toString()
  const res = await api.get<{ logs: any[]; pagination: any }>(`/audit${qs ? '?' + qs : ''}`)
  if (!res.ok) return []

  return res.data.logs.map((r: any) => ({
    id: r.id,
    actorId: r.actor_id,
    actorEmail: r.actor_email,
    actorName: r.actor_name,
    action: r.action,
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    resourceName: r.resource_name,
    ipAddress: r.ip_address,
    details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
    severity: r.severity,
    createdAt: r.created_at,
  }))
}
