import { Navigate, Route, Routes } from 'react-router-dom'
import AdminDashboard from './pages/admin/Dashboard'
import AdminMonitoring from './pages/admin/Monitoring'
import DoctorDashboard from './pages/doctor/Dashboard'
import DoctorReviewPage from './pages/doctor/Review'
import Login from './pages/Login'
import PatientDashboard from './pages/patient/Dashboard'
import PatientUpload from './pages/patient/Upload'
import PatientScanResult from './pages/patient/ScanResult'
import Register from './pages/Register'
import ProtectedRoute from './routes/ProtectedRoute'
import { useAuth } from './context/AuthContext'

function HomeRedirect() {
  const { isAuthenticated, user } = useAuth()
  return <Navigate to={isAuthenticated && user ? `/${user.role}` : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
        <Route path="/patient" element={<PatientDashboard />} />
        <Route path="/patient/upload" element={<PatientUpload />} />
        <Route path="/patient/scans/:scanId/result" element={<PatientScanResult />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/doctor/review/:reviewId" element={<DoctorReviewPage />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/monitoring" element={<AdminMonitoring />} />
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
