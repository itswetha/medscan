import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { AppShell, displayName } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'
import { getDoctorReviews, type ReviewFilter, type ReviewQueueItem } from '../../api/reviews'
import { getMyDoctorProfile } from '../../api/doctors'

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function DoctorDashboard() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<ReviewFilter>('pending')
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profileIncomplete, setProfileIncomplete] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileLoadError, setProfileLoadError] = useState(false)
  const [profileRetryCount, setProfileRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    setProfileLoading(true)
    setProfileLoadError(false)
    getMyDoctorProfile()
      .then((profile) => {
        if (!active) return
        setProfileIncomplete(!profile.specialization?.trim())
      })
      .catch(() => { if (active) setProfileLoadError(true) })
      .finally(() => { if (active) setProfileLoading(false) })
    return () => { active = false }
  }, [user?.id, profileRetryCount])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getDoctorReviews(filter)
      .then((items) => { if (active) setReviews(items) })
      .catch((cause: unknown) => {
        if (!active) return
        setError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not load doctor reviews.')
        setReviews([])
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filter])

  return (
    <AppShell>
      <section className="page-heading">
        <span className="eyebrow">DOCTOR WORKSPACE</span>
        <h1>Welcome, {user ? displayName(user.full_name) : 'there'}</h1>
        <p>Review AI-assisted screening results submitted by patients.</p>
      </section>
      {profileLoadError ? <aside className="doctor-profile-banner" role="alert">
        <span>Could not load your profile status.</span>
        <button type="button" className="button button-quiet" onClick={() => setProfileRetryCount((count) => count + 1)}>Retry</button>
      </aside> : null}
      {!profileLoading && !profileLoadError && profileIncomplete ? <aside className="doctor-profile-banner" role="status">
        <span>Complete your profile so patients can find and select you.</span>
        <Link to="/doctor/profile">Complete profile</Link>
      </aside> : null}
      <section className="placeholder-card review-queue">
        <div className="review-queue-heading">
          <div><h2>Doctor review requests</h2><p>Requests sent to you by patients.</p></div>
          <div className="review-filter" role="group" aria-label="Filter reviews">
            <button type="button" className={filter === 'pending' ? 'selected' : ''} aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>Pending</button>
            <button type="button" className={filter === 'completed' ? 'selected' : ''} aria-pressed={filter === 'completed'} onClick={() => setFilter('completed')}>Completed</button>
          </div>
        </div>
        {loading ? <p className="history-message" role="status">Loading review requests…</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {!loading && !error && reviews.length === 0 ? <p className="history-message">No {filter} reviews.</p> : null}
        {!loading && !error ? <div className="doctor-review-list">
          {reviews.map((review) => (
            <article className="doctor-review-card" key={review.id}>
              <div className="doctor-review-summary">
                <h3>{review.patient_name}</h3>
                <p>Patient ID · {review.patient_id}</p>
                <p className="doctor-review-finding">Top AI finding: <strong>{review.top_prediction ?? 'Unavailable'}</strong>{review.top_probability !== null ? ` · ${(review.top_probability * 100).toFixed(1)}%` : ''}</p>
                <p className="doctor-review-time">Requested {formatDate(review.requested_at)}{review.ai_confidence !== null ? ` · AI confidence ${(review.ai_confidence * 100).toFixed(1)}%` : ''}</p>
              </div>
              <Link className="button button-primary inline-button" to={`/doctor/review/${review.id}`}>Review</Link>
            </article>
          ))}
        </div> : null}
      </section>
    </AppShell>
  )
}
