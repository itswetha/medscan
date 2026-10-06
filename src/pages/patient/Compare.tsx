import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { getPatientScans, getScanImage, getScanResult, type PatientScanHistoryItem, type ScanResult } from '../../api/scans'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'

const probabilityFields = [
  ['normal_probability', 'Normal'],
  ['pneumonia_probability', 'Pneumonia'],
  ['tuberculosis_probability', 'Tuberculosis'],
  ['other_probability', 'Other'],
] as const

type ComparedScan = { scanId: string; result: ScanResult; imageUrl: string }

function formatScanDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function probabilityValue(result: ScanResult, key: typeof probabilityFields[number][0]) {
  return result.prediction ? result.prediction[key] : null
}

function ChangeIndicator({ earlier, later }: { earlier: number | null; later: number | null }) {
  if (earlier === null || later === null) return <span className="comparison-change unavailable">—</span>
  const difference = (later - earlier) * 100
  if (Math.abs(difference) < 0.05) return <span className="comparison-change unchanged" aria-label="No meaningful change">→</span>
  const increased = difference > 0
  return <span className={`comparison-change ${increased ? 'increased' : 'decreased'}`} aria-label={`${increased ? 'Increased' : 'Decreased'} by ${Math.abs(difference).toFixed(1)} percentage points`}>
    {increased ? '↑' : '↓'} {Math.abs(difference).toFixed(1)} pp
  </span>
}

export default function PatientCompare() {
  const { user } = useAuth()
  const [scans, setScans] = useState<PatientScanHistoryItem[]>([])
  const [firstScanId, setFirstScanId] = useState('')
  const [secondScanId, setSecondScanId] = useState('')
  const [comparedScans, setComparedScans] = useState<ComparedScan[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    getPatientScans(user.id)
      .then((items) => {
        if (!active) return
        setScans(items)
        setFirstScanId(items[0]?.scan_id ?? '')
        setSecondScanId(items[1]?.scan_id ?? '')
      })
      .catch((cause: unknown) => {
        if (active) setError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not load your scans.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!firstScanId || !secondScanId || firstScanId === secondScanId) {
      setComparedScans(null)
      setComparing(false)
      return
    }
    let active = true
    let objectUrls: string[] = []
    setComparedScans(null)
    setComparing(true)
    setError('')
    Promise.all([getScanResult(firstScanId), getScanResult(secondScanId)])
      .then(async ([firstResult, secondResult]) => {
        const urls = await Promise.all([getScanImage(firstScanId, 'original'), getScanImage(secondScanId, 'original')])
        if (!active) {
          urls.forEach(URL.revokeObjectURL)
          return
        }
        objectUrls = urls
        setComparedScans([
          { scanId: firstScanId, result: firstResult, imageUrl: urls[0] },
          { scanId: secondScanId, result: secondResult, imageUrl: urls[1] },
        ])
      })
      .catch((cause: unknown) => {
        if (active) setError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not compare these scans.')
      })
      .finally(() => { if (active) setComparing(false) })
    return () => {
      active = false
      objectUrls.forEach(URL.revokeObjectURL)
    }
  }, [firstScanId, secondScanId])

  const firstHistoryScan = scans.find((scan) => scan.scan_id === firstScanId)
  const secondHistoryScan = scans.find((scan) => scan.scan_id === secondScanId)

  return <AppShell>
    <section className="page-heading">
      <span className="eyebrow">PATIENT WORKSPACE</span>
      <h1>Compare scans</h1>
      <p>Compare original images, reliability, and probability changes between two scans.</p>
    </section>
    {loading ? <p className="loading-message" role="status">Loading scans…</p> : null}
    {error && !loading ? <p className="form-error" role="alert">{error}</p> : null}
    {!loading && scans.length < 2 ? <section className="placeholder-card"><p className="history-message">At least two scans are needed for comparison.</p></section> : null}
    {!loading && scans.length >= 2 ? <>
      <section className="result-card compare-selectors" aria-label="Choose scans to compare">
        <label htmlFor="first-scan">First scan</label>
        <select id="first-scan" value={firstScanId} onChange={(event) => setFirstScanId(event.target.value)}>
          {scans.map((scan) => <option key={scan.scan_id} value={scan.scan_id}>{formatScanDate(scan.created_at)}</option>)}
        </select>
        <label htmlFor="second-scan">Second scan</label>
        <select id="second-scan" value={secondScanId} onChange={(event) => setSecondScanId(event.target.value)}>
          {scans.map((scan) => <option key={scan.scan_id} value={scan.scan_id}>{formatScanDate(scan.created_at)}</option>)}
        </select>
      </section>
      {firstScanId === secondScanId ? <p className="history-message">Choose two different scans to compare.</p> : null}
      {comparing ? <p className="loading-message" role="status">Loading scan comparison…</p> : null}
      {comparedScans && firstHistoryScan && secondHistoryScan ? <>
        <div className="compare-scan-grid">
          {comparedScans.map((item, index) => {
            const historyItem = index === 0 ? firstHistoryScan : secondHistoryScan
            return <section className="result-card compare-scan-card" key={item.scanId}>
              <h2>{index === 0 ? 'First scan' : 'Second scan'}</h2>
              <time dateTime={historyItem.created_at}>{formatScanDate(historyItem.created_at)}</time>
              <img src={item.imageUrl} alt={`Original chest X-ray from ${formatScanDate(historyItem.created_at)}`} />
              <p>Image reliability <strong>{item.result.quality.quality_score}/100</strong></p>
              {!item.result.prediction ? <p className="history-message">Prediction is not available for this scan.</p> : null}
            </section>
          })}
        </div>
        <section className="result-card">
          <h2>Probability comparison</h2>
          <div className="comparison-table-wrap"><table className="comparison-table">
            <thead><tr><th scope="col">Finding</th><th scope="col">First scan</th><th scope="col">Change</th><th scope="col">Second scan</th></tr></thead>
            <tbody>{probabilityFields.map(([key, label]) => {
              const firstValue = probabilityValue(comparedScans[0].result, key)
              const secondValue = probabilityValue(comparedScans[1].result, key)
              return <tr key={key}>
                <th scope="row">{label}</th>
                <td>{firstValue === null ? '—' : `${(firstValue * 100).toFixed(1)}%`}</td>
                <td><ChangeIndicator earlier={firstValue} later={secondValue} /></td>
                <td>{secondValue === null ? '—' : `${(secondValue * 100).toFixed(1)}%`}</td>
              </tr>
            })}</tbody>
          </table></div>
        </section>
      </> : null}
    </> : null}
    <Link className="button button-quiet inline-button" to="/patient">Return to dashboard</Link>
  </AppShell>
}