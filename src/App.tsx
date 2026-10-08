import { Navigate, Route, Routes } from 'react-router-dom'
import AdminDashboard from './pages/admin/Dashboard'
import AdminMonitoring from './pages/admin/Monitoring'
import AdminAuditLogs from './pages/admin/AuditLogs'
import DoctorDashboard from './pages/doctor/Dashboard'
import DoctorReviewPage from './pages/doctor/Review'
import DoctorProfilePage from './pages/doctor/Profile'
import Login from './pages/Login'
import PatientDashboard from './pages/patient/Dashboard'
import PatientHealth from './pages/patient/Health'
import PatientGallery from './pages/patient/Gallery'
import PatientCompare from './pages/patient/Compare'
import PatientUpload from './pages/patient/Upload'
import PatientScanResult from './pages/patient/ScanResult'
import ChooseDoctor from './pages/patient/ChooseDoctor'
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
        <Route path="/patient/health" element={<PatientHealth />} />
        <Route path="/patient/gallery" element={<PatientGallery />} />
        <Route path="/patient/compare" element={<PatientCompare />} />
        <Route path="/patient/upload" element={<PatientUpload />} />
        <Route path="/patient/scans/:scanId/result" element={<PatientScanResult />} />
        <Route path="/patient/scans/:scanId/choose-doctor" element={<ChooseDoctor />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/doctor/profile" element={<DoctorProfilePage />} />
        <Route path="/doctor/review/:reviewId" element={<DoctorReviewPage />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/monitoring" element={<AdminMonitoring />} />
        <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
