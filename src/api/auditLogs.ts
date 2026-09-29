import { apiClient } from './client'

export interface AuditLogEntry {
  id: number
  user_id: string | null
  action: string
  resource: string
  timestamp: string
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const response = await apiClient.get<AuditLogEntry[]>('/admin/audit-logs')
  return response.data
}
