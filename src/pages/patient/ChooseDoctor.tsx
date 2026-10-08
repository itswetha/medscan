import { useEffect, useMemo, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDoctorPhoto, getDoctors, type DoctorProfile } from '../../api/doctors'
import { requestScanReview } from '../../api/reviews'
import { AppShell } from '../../components/layout/AppShell'

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function serverError(cause: unknown) {
  if (!isAxiosError(cause) || !cause.response) return 'Could not send this scan for review.'
  const { data, status, statusText } = cause.response
  const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : undefined
  if (typeof detail === 'string') return detail
  if (detail !== undefined && detail !== null) return JSON.stringify(detail)
  if (statusText) return statusText
  return `Request failed with status ${status}`
}

function DoctorCard({ doctor, onSelect }: { doctor: DoctorProfile; onSelect: () => void }) {
  const [photo, setPhoto] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (doctor.profile_photo_url) {
      getDoctorPhoto(doctor.id).then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (active) setPhoto(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      }).catch(() => { if (active) setPhoto('') })
    }
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [doctor.id, doctor.profile_photo_url])

  return <article className="doctor-directory-card">
    <div className="doctor-directory-card-heading">
      {photo ? <img className="doctor-avatar doctor-avatar-image" src={photo} alt={`${doctor.full_name} profile`} /> : <span className="doctor-avatar" aria-hidden="true">{initials(doctor.full_name)}</span>}
      <div><h2>{doctor.full_name}</h2><p>{doctor.specialization}</p></div>
    </div>
    <p className="doctor-experience">{doctor.years_experience === null ? 'Experience not listed' : `${doctor.years_experience}+ years experience`}</p>
    <p className="doctor-bio">{doctor.bio || 'No biography provided.'}</p>
    <button type="button" className="button button-primary" onClick={onSelect}>Select doctor</button>
  </article>
}

export default function ChooseDoctor() {
  const { scanId } = useParams()
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState<DoctorProfile[]>([])
  const [search, setSearch] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getDoctors()
      .then((items) => { if (active) setDoctors(items) })
      .catch((cause: unknown) => {
        if (active) setError(serverError(cause))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const specializations = useMemo(
    () => [...new Set(doctors.map((doctor) => doctor.specialization).filter((value): value is string => Boolean(value)))].sort(),
    [doctors],
  )
  const visibleDoctors = useMemo(() => {
    const term = search.trim().toLowerCase()
    return doctors.filter((doctor) => {
      const matchesSearch = !term || doctor.full_name.toLowerCase().includes(term) || (doctor.specialization ?? '').toLowerCase().includes(term)
      const matchesSpecialization = !specialization || doctor.specialization === specialization
      return matchesSearch && matchesSpecialization
    })
  }, [doctors, search, specialization])

  async function confirmSelection() {
    if (!scanId || !selectedDoctor) return
    setSubmitting(true)
    setError('')
    try {
      await requestScanReview(scanId, selectedDoctor.id)
      navigate(`/patient/scans/${scanId}/result`, { replace: true })
    } catch (cause: unknown) {
      setError(serverError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return <AppShell>
    <section className="page-heading">
      <span className="eyebrow">PATIENT WORKSPACE</span>
      <h1>Choose a doctor</h1>
      <p>Select a doctor to review this scan.</p>
    </section>
    <section className="placeholder-card doctor-directory">
      <div className="doctor-directory-filters">
        <label className="doctor-directory-search">
          <span>Search doctors</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or specialization" />
        </label>
        <label>
          <span>Specialization</span>
          <select value={specialization} onChange={(event) => setSpecialization(event.target.value)}>
            <option value="">All specializations</option>
            {specializations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {loading ? <p className="history-message" role="status">Loading doctors…</p> : null}
      {!loading && !error && doctors.length === 0 ? <p className="history-message">No doctors have completed a profile yet.</p> : null}
      {!loading && !error && doctors.length > 0 && visibleDoctors.length === 0 ? <p className="history-message">No doctors match those filters.</p> : null}
      {!loading && visibleDoctors.length > 0 ? <div className="doctor-directory-grid">
        {visibleDoctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} onSelect={() => { setSelectedDoctor(doctor); setError('') }} />)}
      </div> : null}
    </section>
    {selectedDoctor ? <div className="doctor-confirm-backdrop" role="presentation">
      <section className="doctor-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="doctor-confirm-title">
        <h2 id="doctor-confirm-title">Confirm doctor</h2>
        <p>Send this scan to Dr {selectedDoctor.full_name} for review?</p>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="doctor-confirm-actions">
          <button type="button" className="button button-quiet" disabled={submitting} onClick={() => setSelectedDoctor(null)}>Cancel</button>
          <button type="button" className="button button-primary" disabled={submitting} onClick={() => void confirmSelection()}>{submitting ? 'Sending…' : 'Confirm'}</button>
        </div>
      </section>
    </div> : null}
    <Link className="button button-quiet inline-button" to={`/patient/scans/${scanId}/result`}>Back to result</Link>
  </AppShell>
}
