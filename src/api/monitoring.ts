import { apiClient } from './client'

export interface MonitoringSummary {
  total_predictions: number
  average_confidence: number | null
  class_distribution: Record<'Normal' | 'Pneumonia' | 'Tuberculosis' | 'Other', number>
  model_version_counts: Record<string, number>
}

export interface ConfidenceTrendPoint {
  week_start: string
  average_confidence: number
}

export async function getMonitoringSummary() {
  const { data } = await apiClient.get<MonitoringSummary>('/admin/monitoring')
  return data
}

export async function getConfidenceTrend() {
  const { data } = await apiClient.get<ConfidenceTrendPoint[]>('/admin/monitoring/trend')
  return data
}
