import { Navigate, Outlet } from 'react-router-dom'
import type { UserRole } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export function dashboardForRole(role: UserRole) {
  return `/${role}`
}

export default function ProtectedRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) return <p className="loading-message" role="status">Checking your session…</p>
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={dashboardForRole(user.role)} replace />
  }
  return <Outlet />
}
