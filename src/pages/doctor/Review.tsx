import { useEffect, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { getDoctorReview, getDoctorReviewImage, submitDoctorReview, type DoctorReviewDetail, type ReviewDecision } from '../../api/reviews'

const probabilityLabels = [
  ['normal_probability', 'Normal'],
  ['pneumonia_probability', 'Pneumonia'],
  ['tuberculosis_probability', 'Tuberculosis'],
  ['other_probability', 'Other'],
] as const

const decisionOptions: Array<{ value: ReviewDecision; label: string }> = [
  { value: 'agree', label: 'Agree with AI result' },
  { value: 'disagree', label: 'Disagree with AI result' },
  { value: 'needs_further_evaluation', label: 'Needs further evaluation' },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function decisionLabel(value: ReviewDecision | null) {
  return decisionOptions.find((option) => option.value === value)?.label ?? 'No decision recorded'
}

export default function DoctorReviewPage() {
  const { reviewId } = useParams()
  const [review, setReview] = useState<DoctorReviewDetail | null>(null)
  const [originalUrl, setOriginalUrl] = useState('')
  const [gradcamUrl, setGradcamUrl] = useState('')
  const [decision, setDecision] = useState<ReviewDecision>('agree')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let urls: string[] = []
    async function load() {
      if (!reviewId) { setError('Review request not found.'); setLoading(false); return }
      try {
        const data = await getDoctorReview(reviewId)
        if (!active) return
        setReview(data)
        setDecision(data.decision ?? 'agree')
        setNotes(data.notes ?? '')
        const original = await getDoctorReviewImage(data.images.original)
        const gradcam = data.images.gradcam ? await getDoctorReviewImage(data.images.gradcam) : ''
        urls = [original, gradcam].filter(Boolean)
        if (active) { setOriginalUrl(original); setGradcamUrl(gradcam) }
      } catch (cause) {
        if (active) setError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not load review details.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false; urls.forEach(URL.revokeObjectURL) }
  }, [reviewId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reviewId) return
    setSubmitting(true)
    setError('')
    try {
      const result = await submitDoctorReview(reviewId, decision, notes)
      setReview((current) => current ? {
        ...current,
        status: result.status,
        decision: result.decision,
        notes: result.notes,
        reviewed_at: result.reviewed_at,
        reviewed_by: result.reviewed_by,
      } : current)
    } catch (cause) {
      setError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not submit this review.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <AppShell><p className="loading-message" role="status">Loading review details…</p></AppShell>
  if (error && !review) return <AppShell><section className="placeholder-card"><h1>Review unavailable</h1><p className="form-error">{error}</p><Link className="button button-quiet inline-button" to="/doctor">Return to review queue</Link></section></AppShell>
  if (!review) return null

  const prediction = review.scan.prediction
  return (
    <AppShell>
      <section className="page-heading">
        <span className="eyebrow">DOCTOR WORKSPACE · REVIEW {review.id}</span>
        <h1>Screening review</h1>
        <p>{review.patient.full_name} · Patient ID {review.patient.id} · Requested {formatDate(review.requested_at)}</p>
      </section>

      <section className="result-card">
        <div className="result-section-heading"><div><h2>Scan images</h2><p>Original X-ray and model explainability overlay.</p></div><span className={`review-status ${review.status === 'COMPLETED' ? 'completed' : ''}`}>{review.status}</span></div>
        <div className="image-comparison">
          <figure><img src={originalUrl} alt="Patient chest X-ray" /><figcaption>Original X-ray</figcaption></figure>
          {gradcamUrl ? <figure><img src={gradcamUrl} alt="Grad-CAM heatmap" /><figcaption>Grad-CAM heatmap</figcaption></figure> : null}
        </div>
      </section>

      <section className="metrics-grid">
        <div className="metric-card"><span>Image reliability</span><strong>{review.scan.quality_score}<small> / 100</small></strong><p>Quality check · {review.scan.quality_status}</p>{review.scan.quality_issues.length ? <p>Issues: {review.scan.quality_issues.join(', ')}</p> : <p>No image quality issues detected</p>}</div>
        <div className="metric-card"><span>AI confidence</span><strong>{prediction ? `${(prediction.ai_confidence * 100).toFixed(1)}%` : 'Unavailable'}</strong><p>{prediction ? `Model ${prediction.model_version ?? 'version unavailable'}` : 'No prediction available'}</p></div>
      </section>

      <section className="result-card">
        <h2>AI differential analysis</h2>
        {prediction ? <div className="probability-list">
          {probabilityLabels.map(([key, label]) => {
            const probability = prediction[key]
            const percent = Math.max(0, Math.min(100, probability * 100))
            return <div className="probability-row" key={key}><div className="probability-label"><span>{label}</span><strong>{percent.toFixed(1)}%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div></div>
          })}
        </div> : <p className="history-message">No AI prediction is available for this scan.</p>}
      </section>

      <section className="result-card previous-scans">
        <h2>Patient’s previous scans</h2>
        {review.previous_scans.length ? <div className="history-list">{review.previous_scans.map((scan) => <div className="history-row" key={scan.scan_id}>
          <span className="history-date">{formatDate(scan.created_at)}</span>
          <span className="history-prediction">{scan.top_prediction ? `${scan.top_prediction.class} · ${(scan.top_prediction.probability * 100).toFixed(1)}%` : 'Analysis pending'}</span>
          <span className="history-score">Image reliability <strong>{scan.quality_score}/100</strong></span>
          <span className="review-status">{scan.doctor_review_status.replace('_', ' ')}</span>
        </div>)}</div> : <p className="history-message">No previous scans are available.</p>}
      </section>

      <section className="result-card review-form-card">
        <h2>Doctor verification</h2>
        {review.status === 'COMPLETED' ? <div className="review-complete"><p><strong>{decisionLabel(review.decision)}</strong></p><p>{review.notes || 'No notes provided.'}</p><p>Reviewed by {review.reviewed_by ?? 'doctor'} · {review.reviewed_at ? formatDate(review.reviewed_at) : ''}</p></div> : <form onSubmit={(event) => void handleSubmit(event)}>
          <fieldset className="decision-options"><legend>Review decision</legend>{decisionOptions.map((option) => <label key={option.value}><input type="radio" name="decision" value={option.value} checked={decision === option.value} onChange={() => setDecision(option.value)} />{option.label}</label>)}</fieldset>
          <label className="review-notes-label" htmlFor="review-notes">Notes</label>
          <textarea id="review-notes" value={notes} maxLength={5000} onChange={(event) => setNotes(event.target.value)} placeholder="Add relevant review notes" />
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button-primary inline-button" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Review'}</button>
        </form>}
      </section>
      <p className="diagnosis-notice">The AI output supports screening and does not replace clinical judgment.</p>
      <Link className="button button-quiet inline-button" to="/doctor">Return to review queue</Link>
    </AppShell>
  )
}
