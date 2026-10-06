import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { getPatientScans, getPatientTrend, type PatientScanHistoryItem, type PatientTrendPoint } from '../../api/scans'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'

function formatScanDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export default function PatientHealth() {
  const { user } = useAuth()
  const [scans, setScans] = useState<PatientScanHistoryItem[]>([])
  const [trend, setTrend] = useState<PatientTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([getPatientScans(user.id), getPatientTrend(user.id)])
      .then(([scanItems, trendItems]) => {
        if (!active) return
        setScans(scanItems)
        setTrend(trendItems)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not load your health trends.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user])

  const latestScan = scans[0]

  return <AppShell>
    <section className="page-heading">
      <span className="eyebrow">PATIENT WORKSPACE</span>
      <h1>Health trends</h1>
      <p>Track changes in your screening probabilities across analyzed scans.</p>
    </section>
    {loading ? <p className="loading-message" role="status">Loading health trends…</p> : null}
    {error ? <section className="placeholder-card"><p className="form-error" role="alert">{error}</p></section> : null}
    {!loading && !error ? <>
      <section className="result-card latest-scan-card">
        <div className="result-section-heading"><div><h2>Latest scan</h2><p>{latestScan ? formatScanDate(latestScan.created_at) : 'No scans recorded yet'}</p></div></div>
        {latestScan ? <>
          <strong className="latest-scan-prediction">{latestScan.top_prediction ? `${latestScan.top_prediction.class} · ${(latestScan.top_prediction.probability * 100).toFixed(1)}% confidence` : 'Analysis pending'}</strong>
          <p>Image reliability · {latestScan.quality_score}/100</p>
          <Link className="button button-quiet inline-button" to={`/patient/scans/${latestScan.scan_id}/result`}>View result</Link>
        </> : <p className="history-message">Upload a scan to start building your health history.</p>}
      </section>

      <section className="result-card">
        <div className="result-section-heading"><div><h2>Probability over time</h2><p>Values are plotted oldest to newest for scans with completed analysis.</p></div></div>
        {trend.length ? <div className="patient-trend-chart" role="img" aria-label="Pneumonia and tuberculosis probabilities by scan date">
          {trend.map((point, index) => {
            const pneumonia = Math.max(0, Math.min(100, point.pneumonia_probability * 100))
            const tuberculosis = Math.max(0, Math.min(100, point.tuberculosis_probability * 100))
            return <div className="patient-trend-column" key={`${point.date}-${index}`} title={`${formatScanDate(point.date)} · Pneumonia ${pneumonia.toFixed(1)}% · Tuberculosis ${tuberculosis.toFixed(1)}%`}>
              <div className="patient-trend-values"><span>{pneumonia.toFixed(0)}%</span><span>{tuberculosis.toFixed(0)}%</span></div>
              <div className="patient-trend-bars"><div className="patient-trend-bar pneumonia" style={{ height: `${Math.max(2, pneumonia)}%` }} /><div className="patient-trend-bar tuberculosis" style={{ height: `${Math.max(2, tuberculosis)}%` }} /></div>
              <time dateTime={point.date}>{formatScanDate(point.date)}</time>
            </div>
          })}
        </div> : <p className="monitoring-empty">No analyzed scans are available for a trend yet.</p>}
        {trend.length ? <div className="patient-trend-legend"><span><i className="pneumonia" />Pneumonia</span><span><i className="tuberculosis" />Tuberculosis</span></div> : null}
      </section>
    </> : null}
    <Link className="button button-quiet inline-button" to="/patient">Return to dashboard</Link>
  </AppShell>
}