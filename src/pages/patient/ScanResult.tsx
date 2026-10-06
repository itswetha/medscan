import { useEffect, useMemo, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link, useParams } from 'react-router-dom'
import { downloadScanReport, getScanImage, getScanResult, type ScanResult as ScanResultData } from '../../api/scans'
import { AppShell } from '../../components/layout/AppShell'
import { XrayViewer } from '../../components/XrayViewer'
import { requestScanReview } from '../../api/reviews'

const classLabels = {
  normal_probability: 'Normal',
  pneumonia_probability: 'Pneumonia',
  tuberculosis_probability: 'Tuberculosis',
  other_probability: 'Other',
} as const

export default function ScanResult() {
  const { scanId } = useParams()
  const [result, setResult] = useState<ScanResultData | null>(null)
  const [originalUrl, setOriginalUrl] = useState('')
  const [gradcamUrl, setGradcamUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingReport, setDownloadingReport] = useState(false)
  const [reportError, setReportError] = useState('')
  const [requestingReview, setRequestingReview] = useState(false)
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    let cancelled = false
    let objectUrls: string[] = []

    async function load() {
      if (!scanId) {
        setError('Scan not found.')
        setLoading(false)
        return
      }
      try {
        const scanResult = await getScanResult(scanId)
        if (cancelled) return
        setResult(scanResult)
        if (scanResult.prediction) {
          const original = await getScanImage(scanId, 'original')
          const heatmap = await getScanImage(scanId, 'gradcam')
          objectUrls = [original, heatmap]
          if (!cancelled) {
            setOriginalUrl(original)
            setGradcamUrl(heatmap)
          }
        }
      } catch (cause) {
        if (!cancelled) {
          setError(isAxiosError(cause) ? (cause.response?.data?.detail ?? 'Could not load this scan result.') : 'Could not load this scan result.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      objectUrls.forEach(URL.revokeObjectURL)
    }
  }, [scanId])

  async function handleRequestDoctorReview() {
    if (!scanId) return
    setRequestingReview(true)
    setReviewError('')
    try {
      const created = await requestScanReview(scanId)
      setResult((current) => current ? {
        ...current,
        doctor_review: {
          id: created.id,
          status: created.status,
          decision: null,
          notes: null,
          requested_at: created.requested_at,
          reviewed_at: null,
          doctor_name: null,
        },
      } : current)
    } catch (cause) {
      setReviewError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not request doctor verification.')
    } finally {
      setRequestingReview(false)
    }
  }

  function reviewDecisionLabel(value: NonNullable<ScanResultData['doctor_review']>['decision']) {
    if (value === 'agree') return 'Agrees with AI result'
    if (value === 'disagree') return 'Disagrees with AI result'
    if (value === 'needs_further_evaluation') return 'Needs further evaluation'
    return ''
  }

  async function handleDownloadReport() {
    if (!scanId) return
    setDownloadingReport(true)
    setReportError('')
    let objectUrl = ''
    try {
      objectUrl = await downloadScanReport(scanId)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `medscan-report-${scanId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch {
      setReportError('Could not download the PDF report.')
    } finally {
      setDownloadingReport(false)
    }
  }

  const probabilities = useMemo(() => {
    if (!result?.prediction) return []
    return (Object.keys(classLabels) as Array<keyof typeof classLabels>)
      .map((key) => ({ label: classLabels[key], value: result.prediction![key] }))
      .sort((left, right) => right.value - left.value)
  }, [result])

  if (loading) {
    return <AppShell><p className="loading-message" role="status">Loading scan result…</p></AppShell>
  }
  if (error || !result) {
    return <AppShell><section className="placeholder-card"><h1>Result unavailable</h1><p>{error || 'Could not load this scan result.'}</p><Link className="button button-quiet inline-button" to="/patient">Return to dashboard</Link></section></AppShell>
  }

  return (
    <AppShell>
      <section className="page-heading">
        <span className="eyebrow">PATIENT WORKSPACE · SCAN {result.scan_id}</span>
        <h1>Screening result</h1>
        <p>AI-assisted analysis for this uploaded chest X-ray.</p>
      </section>

      {result.quality.quality_status === 'poor' && result.quality.user_continued_anyway && (
        <p className="reliability-notice">This prediction was generated from an image with moderate reliability. Image quality may affect the result.</p>
      )}

      {result.prediction ? (
        <>
          <section className="result-card">
            <div className="result-section-heading">
              <div><h2>Differential analysis</h2><p>Class probabilities from the screening model.</p></div>
              <span className="model-version">Model {result.prediction.model_version}</span>
            </div>
            <div className="probability-list">
              {probabilities.map(({ label, value }) => {
                const percent = Math.max(0, Math.min(100, value * 100))
                return (
                  <div className="probability-row" key={label}>
                    <div className="probability-label"><span>{label}</span><strong>{percent.toFixed(1)}%</strong></div>
                    <div className="progress-track" role="progressbar" aria-label={`${label} probability`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                      <div className="progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                    <details className="probability-explanation">
                      <summary>Why this result?</summary>
                      <p>This prediction is based on patterns the model identified in the highlighted regions of the AI explanation above.</p>
                    </details>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="metrics-grid" aria-label="Screening reliability metrics">
            <div className="metric-card">
              <span>Image reliability</span>
              <strong>{result.quality.quality_score}<small> / 100</small></strong>
              <p>Image quality check · {result.quality.quality_status}</p>
            </div>
            <div className="metric-card">
              <span>AI confidence</span>
              <strong>{(result.prediction.ai_confidence * 100).toFixed(1)}<small>%</small></strong>
              <p>Model confidence · shown separately from image quality</p>
            </div>
          </section>

          <section className="result-card explainability-card">
            <h2>Explainability</h2>
            <XrayViewer originalUrl={originalUrl} heatmapUrl={gradcamUrl} />
            <p className="explainability-caption">Highlighted regions represent areas that most influenced the model's prediction. This is an interpretability aid, not medical confirmation.</p>
          </section>
        </>
      ) : (
        <section className="placeholder-card"><h2>Analysis is not available yet</h2><p>This scan has not completed AI analysis.</p></section>
      )}

      <p className="diagnosis-notice">This AI-generated result is not a final medical diagnosis. A licensed doctor must review and verify the result.</p>
      {result.prediction ? <button className="button button-primary inline-button" type="button" disabled={downloadingReport} onClick={() => void handleDownloadReport()}>{downloadingReport ? 'Preparing report…' : 'Download Report (PDF)'}</button> : null}
      {reportError ? <p className="form-error" role="alert">{reportError}</p> : null}
      {result.prediction && !result.doctor_review ? <button className="button button-quiet inline-button" type="button" disabled={requestingReview} onClick={() => void handleRequestDoctorReview()}>{requestingReview ? 'Requesting…' : 'Verify with Doctor'}</button> : null}
      {result.doctor_review ? <section className="doctor-review-status-card" aria-live="polite"><strong>Doctor review: {result.doctor_review.status === 'COMPLETED' ? 'Completed' : 'Pending'}</strong>{result.doctor_review.status === 'COMPLETED' ? <><p>{reviewDecisionLabel(result.doctor_review.decision)}{result.doctor_review.doctor_name ? ` · ${result.doctor_review.doctor_name}` : ''}</p>{result.doctor_review.notes ? <p>{result.doctor_review.notes}</p> : null}</> : <p>Your result is awaiting review by a doctor.</p>}</section> : null}
      {reviewError ? <p className="form-error" role="alert">{reviewError}</p> : null}
      <br />
      <Link className="button button-quiet inline-button" to="/patient">Return to dashboard</Link>
    </AppShell>
  )
}
