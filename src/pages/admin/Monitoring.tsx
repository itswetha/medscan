import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { getConfidenceTrend, getMonitoringSummary, type ConfidenceTrendPoint, type MonitoringSummary } from '../../api/monitoring'
import { AppShell } from '../../components/layout/AppShell'

const classOrder: Array<keyof MonitoringSummary['class_distribution']> = ['Normal', 'Pneumonia', 'Tuberculosis', 'Other']

function formatWeek(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function MonitoringCharts({ summary, trend }: { summary: MonitoringSummary; trend: ConfidenceTrendPoint[] }) {
  return <>
    <section className="result-card monitoring-card">
      <h2>Prediction class distribution</h2>
      <p>Share of predictions by their highest probability class.</p>
      <div className="monitoring-distribution">
        {classOrder.map((label) => {
          const percentage = summary.class_distribution[label] ?? 0
          return <div className="monitoring-distribution-row" key={label}>
            <div className="probability-label"><span>{label}</span><strong>{percentage.toFixed(1)}%</strong></div>
            <div className="progress-track" role="progressbar" aria-label={`${label} prediction share`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
              <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} />
            </div>
          </div>
        })}
      </div>
    </section>

    <section className="result-card monitoring-card">
      <h2>Weekly average AI confidence</h2>
      <p>Average confidence grouped by prediction week.</p>
      {trend.length ? <div className="trend-chart" role="img" aria-label="Weekly average AI confidence bar chart">
        {trend.map((point) => {
          const percentage = Math.max(0, Math.min(100, point.average_confidence * 100))
          return <div className="trend-column" key={point.week_start} title={`${formatWeek(point.week_start)} · ${percentage.toFixed(1)}%`}>
            <div className="trend-value">{percentage.toFixed(0)}%</div>
            <div className="trend-bar-area"><div className="trend-bar" style={{ height: `${Math.max(2, percentage)}%` }} /></div>
            <time dateTime={point.week_start}>{formatWeek(point.week_start)}</time>
          </div>
        })}
      </div> : <p className="monitoring-empty">No weekly trend data yet.</p>}
    </section>

    <section className="result-card monitoring-card">
      <h2>Predictions by model version</h2>
      {Object.entries(summary.model_version_counts).length ? <div className="model-count-list">
        {Object.entries(summary.model_version_counts).map(([version, count]) => <div className="model-count-row" key={version}><span>{version}</span><strong>{count}</strong></div>)}
      </div> : <p className="monitoring-empty">No model version counts available.</p>}
    </section>
  </>
}

export default function AdminMonitoring() {
  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [trend, setTrend] = useState<ConfidenceTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getMonitoringSummary(), getConfidenceTrend()])
      .then(([summaryData, trendData]) => {
        if (!active) return
        setSummary(summaryData)
        setTrend(trendData)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not load model monitoring data.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <AppShell>
    <section className="page-heading">
      <span className="eyebrow">ADMIN WORKSPACE</span>
      <h1>Model monitoring</h1>
      <p>Read-only summary of prediction volume, confidence, and model versions.</p>
    </section>
    {loading ? <p className="loading-message" role="status">Loading monitoring data…</p> : null}
    {error ? <section className="placeholder-card"><p className="form-error" role="alert">{error}</p></section> : null}
    {!loading && !error && summary ? <>
      <section className="metrics-grid monitoring-metrics">
        <div className="metric-card"><span>Total predictions</span><strong>{summary.total_predictions}</strong><p>Recorded analyses</p></div>
        <div className="metric-card"><span>Average confidence</span><strong>{summary.average_confidence === null ? '—' : `${(summary.average_confidence * 100).toFixed(1)}%`}</strong><p>Across all predictions</p></div>
      </section>
      {summary.total_predictions === 0 ? <section className="placeholder-card no-predictions"><p>No predictions yet</p></section> : <MonitoringCharts summary={summary} trend={trend} />}
    </> : null}
    <Link className="button button-quiet inline-button" to="/admin">Return to admin dashboard</Link>
  </AppShell>
}
