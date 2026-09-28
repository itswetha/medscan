import { useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import type { UserRole } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('patient')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated && user) return <Navigate to={`/${user.role}`} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register({ full_name: fullName, email, password, role })
      navigate('/login', { replace: true, state: { message: 'Account created. Sign in to continue.' } })
    } catch (cause) {
      setError(isAxiosError(cause) ? (cause.response?.data?.detail ?? 'Unable to create account. Please try again.') : 'Unable to create account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <div className="auth-heading">
          <span className="eyebrow">RESPIRATORY SCREENING PLATFORM</span>
          <h1 id="register-title">Create an account</h1>
          <p>Register as a patient or licensed doctor.</p>
        </div>
        <form onSubmit={handleSubmit} className="form-stack">
          <label htmlFor="full-name">Full name</label>
          <input id="full-name" type="text" autoComplete="name" maxLength={255} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          <label htmlFor="role">Account type</label>
          <select id="role" value={role} onChange={(event) => setRole(event.target.value as Exclude<UserRole, 'admin'>)}>
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
          </select>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary form-submit" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-footer">Already registered? <Link to="/login">Sign in</Link></p>
      </section>
    </main>
  )
}
