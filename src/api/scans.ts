import { apiClient } from './client'

export interface ScanQualityResult {
  scan_id: string
  quality_score: number
  quality_status: 'good' | 'poor'
  quality_issues: string[]
}

export async function uploadScan(file: File, onProgress: (percent: number) => void) {
  const body = new FormData()
  body.append('file', file)
  const { data } = await apiClient.post<ScanQualityResult>('/scans/upload', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
  return data
}

export async function continueWithPoorQuality(scanId: string) {
  const { data } = await apiClient.post<{ scan_id: string; user_continued_anyway: boolean }>(
    `/scans/${scanId}/continue-anyway`,
  )
  return data
}

export interface ScanResult {
  scan_id: string
  quality: {
    quality_score: number
    quality_status: 'good' | 'poor'
    quality_issues: string[]
    user_continued_anyway: boolean
  }
  prediction: {
    normal_probability: number
    pneumonia_probability: number
    tuberculosis_probability: number
    other_probability: number
    ai_confidence: number
    gradcam_path: string
    model_version: string
    created_at: string
  } | null
  doctor_review: {
    id: string
    status: 'PENDING' | 'COMPLETED'
    decision: 'agree' | 'disagree' | 'needs_further_evaluation' | null
    notes: string | null
    requested_at: string
    reviewed_at: string | null
    doctor_name: string | null
  } | null
  images: { original: string; gradcam: string | null }
}

export interface AnalyzeResponse {
  scan_id: string
  normal_probability: number
  pneumonia_probability: number
  tuberculosis_probability: number
  other_probability: number
  ai_confidence: number
  gradcam_path: string
  model_version: string
}

export async function analyzeScan(scanId: string) {
  const { data } = await apiClient.post<AnalyzeResponse>(`/scans/${scanId}/analyze`)
  return data
}

export async function getScanResult(scanId: string) {
  const { data } = await apiClient.get<ScanResult>(`/scans/${scanId}/result`)
  return data
}

export async function getScanImage(scanId: string, kind: 'original' | 'gradcam') {
  const { data } = await apiClient.get<Blob>(`/scans/${scanId}/images/${kind}`, { responseType: 'blob' })
  return URL.createObjectURL(data)
}


export interface PatientScanHistoryItem {
  scan_id: string
  created_at: string
  quality_score: number
  quality_status: 'good' | 'poor'
  top_prediction: { class: 'Normal' | 'Pneumonia' | 'Tuberculosis' | 'Other'; probability: number } | null
  doctor_review_status: 'NOT_REQUESTED' | 'PENDING' | 'COMPLETED'
}

export class PatientScanResponseError extends Error {
  constructor() {
    super('The screening history endpoint returned data in an unexpected format.')
    this.name = 'PatientScanResponseError'
  }
}

function isPatientScanHistoryItem(value: unknown): value is PatientScanHistoryItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  if (
    typeof item.scan_id !== 'string' ||
    typeof item.created_at !== 'string' || Number.isNaN(Date.parse(item.created_at)) ||
    typeof item.quality_score !== 'number' ||
    (item.quality_status !== 'good' && item.quality_status !== 'poor') ||
    (item.doctor_review_status !== 'NOT_REQUESTED' && item.doctor_review_status !== 'PENDING' && item.doctor_review_status !== 'COMPLETED')
  ) return false

  if (item.top_prediction === null) return true
  if (typeof item.top_prediction !== 'object') return false
  const prediction = item.top_prediction as Record<string, unknown>
  return (
    (prediction.class === 'Normal' || prediction.class === 'Pneumonia' || prediction.class === 'Tuberculosis' || prediction.class === 'Other') &&
    typeof prediction.probability === 'number'
  )
}

function parsePatientScanHistory(data: unknown): PatientScanHistoryItem[] {
  // The FastAPI route serializes a bare array. Reject HTML/proxy pages or envelopes explicitly.
  if (!Array.isArray(data) || !data.every(isPatientScanHistoryItem)) {
    throw new PatientScanResponseError()
  }
  return data
}

export async function getPatientScans(patientId: string): Promise<PatientScanHistoryItem[]> {
  const { data } = await apiClient.get<unknown>(`/patients/${patientId}/scans`)
  return parsePatientScanHistory(data)
}

export async function downloadScanReport(scanId: string) {
  const { data } = await apiClient.get<Blob>(`/scans/${scanId}/report.pdf`, { responseType: 'blob' })
  return URL.createObjectURL(data)
}
