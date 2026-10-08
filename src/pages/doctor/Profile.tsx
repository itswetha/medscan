import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { getDoctorPhoto, getMyDoctorProfile, updateMyDoctorProfile, uploadMyDoctorPhoto } from '../../api/doctors'
import { AppShell } from '../../components/layout/AppShell'

function profileSaveError(cause: unknown) {
  if (!isAxiosError(cause) || !cause.response) return 'Could not save your profile.'
  const { data, status, statusText } = cause.response
  const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : undefined
  if (typeof detail === 'string') return detail
  if (detail !== undefined && detail !== null) return JSON.stringify(detail)
  if (statusText) return statusText
  if (typeof data === 'string' && data) return data
  return `Request failed with status ${status}`
}

export default function DoctorProfilePage() {
  const [specialization, setSpecialization] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [bio, setBio] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const photoPreviewRef = useRef('')

  function replacePhotoPreview(url: string) {
    if (photoPreviewRef.current.startsWith('blob:')) URL.revokeObjectURL(photoPreviewRef.current)
    photoPreviewRef.current = url
    setPhotoPreview(url)
  }

  useEffect(() => {
    let active = true
    getMyDoctorProfile()
      .then((profile) => {
        if (!active) return
        setSpecialization(profile.specialization ?? '')
        setYearsExperience(profile.years_experience === null ? '' : String(profile.years_experience))
        setBio(profile.bio ?? '')
        if (profile.profile_photo_url) {
          getDoctorPhoto(profile.id).then((blob) => {
            if (active) replacePhotoPreview(URL.createObjectURL(blob))
          }).catch(() => { /* Keep the placeholder when no image can be loaded. */ })
        }
      })
      .catch((cause: unknown) => {
        if (active) setProfileError(isAxiosError(cause) && typeof cause.response?.data?.detail === 'string' ? cause.response.data.detail : 'Could not load your profile.')
      })
      .finally(() => { if (active) setProfileLoading(false) })
    return () => {
      active = false
      if (photoPreviewRef.current.startsWith('blob:')) URL.revokeObjectURL(photoPreviewRef.current)
    }
  }, [])

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileSaving(true)
    setProfileError('')
    setProfileSaved(false)
    try {
      const profile = await updateMyDoctorProfile({
        specialization: specialization.trim(),
        years_experience: yearsExperience === '' ? null : Number(yearsExperience),
        bio: bio.trim() || null,
      })
      if (photoFile) {
        await uploadMyDoctorPhoto(photoFile)
        setPhotoFile(null)
      }
      setSpecialization(profile.specialization ?? '')
      setYearsExperience(profile.years_experience === null ? '' : String(profile.years_experience))
      setBio(profile.bio ?? '')
      setProfileSaved(true)
    } catch (cause: unknown) {
      setProfileError(profileSaveError(cause))
    } finally {
      setProfileSaving(false)
    }
  }

  return <AppShell>
    <section className="page-heading">
      <span className="eyebrow">DOCTOR WORKSPACE</span>
      <h1>My profile</h1>
      <p>Share your professional background with patients.</p>
    </section>
    <section className="placeholder-card doctor-profile-card">
      {profileLoading ? <p className="history-message" role="status">Loading your profile…</p> : <form className="form-stack doctor-profile-form" onSubmit={saveProfile}>
        <label htmlFor="doctor-photo">Profile photo <span className="optional-label">(optional)</span></label>
        <div className="doctor-photo-control">
          {photoPreview ? <img className="doctor-photo-preview" src={photoPreview} alt="Doctor profile preview" /> : <span className="doctor-photo-preview doctor-photo-placeholder" aria-hidden="true">Photo</span>}
          <input id="doctor-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            setPhotoFile(file)
            if (file) replacePhotoPreview(URL.createObjectURL(file))
          }} />
          {photoFile ? <span className="doctor-photo-filename">{photoFile.name}</span> : null}
          <small>JPEG, PNG, or WebP; maximum 5 MB.</small>
        </div>
        <label htmlFor="doctor-specialization">Specialization</label>
        <input id="doctor-specialization" value={specialization} onChange={(event) => setSpecialization(event.target.value)} maxLength={255} required />
        <label htmlFor="doctor-experience">Years of experience</label>
        <input id="doctor-experience" type="number" min="0" max="100" value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} />
        <label htmlFor="doctor-bio">Short bio</label>
        <textarea id="doctor-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={300} rows={4} />
        <span className="doctor-bio-count">{bio.length}/300 characters</span>
        {profileError ? <p className="form-error" role="alert">{profileError}</p> : null}
        {profileSaved ? <p className="profile-success" role="status">Profile saved.</p> : null}
        <button className="button button-primary" type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save profile'}</button>
      </form>}
      <Link className="button button-quiet inline-button doctor-profile-back" to="/doctor">Back to dashboard</Link>
    </section>
  </AppShell>
}
