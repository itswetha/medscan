import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { getPatientScans, PatientScanResponseError, type PatientScanHistoryItem } from '../../api/scans'
import { AppShell, displayName } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'

function formatScanDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function PatientDashboard() {
  const { user } = useAuth()
  const [scans, setScans] = useState<PatientScanHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getPatientScans(user.id)
      .then((items) => { if (!cancelled) setScans(items) })
      .catch((cause: unknown) => {
        if (!cancelled) {
          const message = cause instanceof PatientScanResponseError
            ? cause.message
            : isAxiosError(cause) && typeof cause.response?.data?.detail === 'string'
              ? cause.response.data.detail
              : 'Could not load screening history.'
          setError(message)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user])

  return (
    <AppShell>
      <section className="page-heading">
        <span className="eyebrow">PATIENT WORKSPACE</span>
        <h1>Welcome, {user ? displayName(user.full_name) : 'there'}</h1>
        <p>Your respiratory screening activity and past results.</p>
      </section>
      <section className="placeholder-card history-section">
        <div className="history-heading">
          <div><h2>Screening history</h2><p>Review past scans and their AI-assisted screening results.</p></div>
          <Link className="button button-primary inline-button" to="/patient/upload">Upload X-ray</Link>
        </div>
        {loading ? <p className="history-message" role="status">Loading screening history…</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {!loading && !error && scans.length === 0 ? <p className="history-message">There are no screenings to show yet.</p> : null}
        {!loading && scans.length > 0 ? (
          <div className="history-list">
            {scans.map((scan) => (
              <Link className="history-row" to={`/patient/scans/${scan.scan_id}/result`} key={scan.scan_id}>
                <span className="history-date">{formatScanDate(scan.created_at)}</span>
                <span className="history-prediction">{scan.top_prediction ? `${scan.top_prediction.class} · ${(scan.top_prediction.probability * 100).toFixed(1)}%` : 'Analysis pending'}</span>
                <span className="history-score">Image reliability <strong>{scan.quality_score}/100</strong></span>
                <span className={`review-status ${scan.doctor_review_status === 'COMPLETED' ? 'completed' : scan.doctor_review_status === 'NOT_REQUESTED' ? 'not-requested' : ''}`}>{scan.doctor_review_status}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </AppShell>
  )
}
