import { getRawDb } from '../db/database'
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

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const db = getRawDb()
    const now = new Date().toISOString()
    
    db.prepare(`
      INSERT INTO audit_logs (actor_id, actor_email, action, resource_type, resource_id, resource_name, ip_address, details, severity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.actorId ?? null,
      entry.actorEmail ?? null,
      entry.action,
      entry.resourceType ?? null,
      entry.resourceId ?? null,
      entry.resourceName ?? null,
      entry.ipAddress ?? null,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.severity ?? 'info',
      now
    )
  } catch (err) {
    console.error('[AuditService] Failed to write audit log:', err)
  }
}

export function getAuditLogs(filters: {
  actorId?: string
  action?: string
  resourceType?: string
  severity?: AuditSeverity
  from?: string
  to?: string
  limit?: number
  offset?: number
}) {
  const db = getRawDb()
  const conditions: string[] = []
  const params: unknown[] = []
  
  if (filters.actorId) { conditions.push('actor_id = ?'); params.push(filters.actorId) }
  if (filters.action) { conditions.push('action LIKE ?'); params.push(`%${filters.action}%`) }
  if (filters.resourceType) { conditions.push('resource_type = ?'); params.push(filters.resourceType) }
  if (filters.severity) { conditions.push('severity = ?'); params.push(filters.severity) }
  if (filters.from) { conditions.push('created_at >= ?'); params.push(filters.from) }
  if (filters.to) { conditions.push('created_at <= ?'); params.push(filters.to) }
  
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 100
  const offset = filters.offset ?? 0
  
  const rows = db.prepare(`
    SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[]
  
  return rows.map(r => ({
    id: r.id,
    actorId: r.actor_id,
    actorEmail: r.actor_email,
    action: r.action,
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    resourceName: r.resource_name,
    ipAddress: r.ip_address,
    details: r.details ? JSON.parse(r.details) : null,
    severity: r.severity,
    createdAt: r.created_at
  }))
}
