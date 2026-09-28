import { apiClient } from './client'

export type ReviewStatus = 'PENDING' | 'COMPLETED'
export type ReviewDecision = 'agree' | 'disagree' | 'needs_further_evaluation'
export type ReviewFilter = 'pending' | 'completed'

export interface ReviewQueueItem {
  id: string
  status: ReviewStatus
  requested_at: string
  patient_id: string
  patient_name: string
  scan_id: string
  top_prediction: string | null
  top_probability: number | null
  ai_confidence: number | null
}

export interface DoctorReviewDetail {
  id: string
  status: ReviewStatus
  decision: ReviewDecision | null
  notes: string | null
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  patient: { id: string; full_name: string; email: string }
  scan: {
    id: string
    created_at: string
    quality_score: number
    quality_status: 'good' | 'poor'
    quality_issues: string[]
    user_continued_anyway: boolean
    prediction: {
      normal_probability: number
      pneumonia_probability: number
      tuberculosis_probability: number
      other_probability: number
      ai_confidence: number
      model_version: string | null
    } | null
  }
  images: { original: string; gradcam: string | null }
  previous_scans: Array<{
    scan_id: string
    created_at: string
    quality_score: number
    quality_status: 'good' | 'poor'
    top_prediction: { class: string; probability: number } | null
    doctor_review_status: 'NOT_REQUESTED' | 'PENDING' | 'COMPLETED'
  }>
}

export async function requestScanReview(scanId: string) {
  const { data } = await apiClient.post<{
    id: string
    scan_id: string
    status: ReviewStatus
    requested_at: string
  }>(`/scans/${scanId}/request-review`)
  return data
}

export async function getDoctorReviews(status: ReviewFilter) {
  const { data } = await apiClient.get<ReviewQueueItem[]>('/doctor/reviews', { params: { status } })
  return data
}

export async function getDoctorReview(reviewId: string) {
  const { data } = await apiClient.get<DoctorReviewDetail>(`/doctor/reviews/${reviewId}`)
  return data
}

export async function getDoctorReviewImage(path: string) {
  const { data } = await apiClient.get<Blob>(path, { responseType: 'blob' })
  return URL.createObjectURL(data)
}

export async function submitDoctorReview(reviewId: string, decision: ReviewDecision, notes: string) {
  const { data } = await apiClient.post<{
    id: string
    status: ReviewStatus
    decision: ReviewDecision
    notes: string | null
    reviewed_at: string
    reviewed_by: string
  }>(`/doctor/reviews/${reviewId}/submit`, { decision, notes })
  return data
}
