import { useEffect, useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { getAuditLogs, type AuditLogEntry } from '../../api/auditLogs'

export default function AuditLogs() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAuditLogs()
      .then(setEntries)
      .catch(() => setError('Audit activity could not be loaded.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <section className="page-heading">
        <span className="eyebrow">ADMIN WORKSPACE</span>
        <h1>Audit logs</h1>
        <p>Recent security relevant activity, newest first.</p>
      </section>
      <section className="placeholder-card audit-card">
        {loading ? <p className="monitoring-empty">Loading audit activity…</p>
          : error ? <p className="form-error">{error}</p>
          : entries.length === 0 ? <p className="monitoring-empty">No audit activity yet.</p>
          : <div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.id}><td>{new Date(entry.timestamp).toLocaleString()}</td><td>{entry.user_id ?? 'System / unknown'}</td><td>{entry.action}</td><td>{entry.resource}</td></tr>)}</tbody></table></div>}
      </section>
    </AppShell>
  )
}
