import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { getPatientScans, getScanImage, type PatientScanHistoryItem } from '../../api/scans'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'

function formatScanDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function GalleryCard({ scan }: { scan: PatientScanHistoryItem }) {
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    let active = true
    let objectUrl = ''
    getScanImage(scan.scan_id, 'original')
      .then((url) => {
        if (active) {
          objectUrl = url
          setImageUrl(url)
        } else {
          URL.revokeObjectURL(url)
        }
      })
      .catch(() => {})
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [scan.scan_id])

  return <Link className="gallery-card" to={`/patient/scans/${scan.scan_id}/result`}>
    <div className="gallery-thumbnail">
      {imageUrl ? <img src={imageUrl} alt={`Chest X-ray from ${formatScanDate(scan.created_at)}`} /> : <span>Image unavailable</span>}
    </div>
    <div className="gallery-card-details">
      <time dateTime={scan.created_at}>{formatScanDate(scan.created_at)}</time>
      <strong>{scan.top_prediction ? `${scan.top_prediction.class} · ${(scan.top_prediction.probability * 100).toFixed(1)}%` : 'Analysis pending'}</strong>
    </div>
  </Link>
}

export default function PatientGallery() {
  const { user } = useAuth()
  const [scans, setScans] = useState<PatientScanHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    getPatientScans(user.id)
      .then((items) => { if (active) setScans(items) })
      .catch((cause: unknown) => {
        if (active) setError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not load your scan gallery.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user])

  return <AppShell>
    <section className="page-heading">
      <span className="eyebrow">PATIENT WORKSPACE</span>
      <h1>X-ray gallery</h1>
      <p>Your past scans and their screening summaries.</p>
    </section>
    {loading ? <p className="loading-message" role="status">Loading scan gallery…</p> : null}
    {error ? <section className="placeholder-card"><p className="form-error" role="alert">{error}</p></section> : null}
    {!loading && !error && scans.length === 0 ? <section className="placeholder-card"><p className="history-message">There are no scans to show yet.</p></section> : null}
    {!loading && !error && scans.length > 0 ? <section className="gallery-grid" aria-label="Past X-ray scans">
      {scans.map((scan) => <GalleryCard scan={scan} key={scan.scan_id} />)}
    </section> : null}
    <Link className="button button-quiet inline-button" to="/patient">Return to dashboard</Link>
  </AppShell>
}