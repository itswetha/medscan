import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useAuth } from '../context/AuthContext'
import { dashboardForRole } from '../routes/ProtectedRoute'

export default function Login() {
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated && user) return <Navigate to={dashboardForRole(user.role)} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const signedInUser = await login(email, password)
      navigate(dashboardForRole(signedInUser.role), { replace: true })
    } catch (cause) {
      setError(isAxiosError(cause) ? (cause.response?.data?.detail ?? 'Unable to sign in. Please try again.') : 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-heading">
          <span className="eyebrow">RESPIRATORY SCREENING PLATFORM</span>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to continue to your screening workspace.</p>
        </div>
        <form onSubmit={handleSubmit} className="form-stack">
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary form-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-footer">New to the platform? <Link to="/register">Create an account</Link></p>
      </section>
    </main>
  )
}
