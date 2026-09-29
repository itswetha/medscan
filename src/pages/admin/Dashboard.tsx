import { AppShell, displayName } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  const { user } = useAuth()
  return (
    <AppShell>
      <section className="page-heading">
        <span className="eyebrow">ADMIN WORKSPACE</span>
        <h1>Welcome, {user ? displayName(user.full_name) : 'there'}</h1>
        <p>Platform activity and model monitoring will appear here.</p>
      </section>
      <section className="placeholder-card">
        <h2>Platform overview</h2>
        <p>Review aggregate prediction and model confidence trends.</p>
        <Link className="button button-primary inline-button" to="/admin/monitoring">Open model monitoring</Link>
        <Link className="button button-quiet inline-button audit-link" to="/admin/audit-logs">View audit logs</Link>
      </section>
    </AppShell>
  )
}
