import { apiClient } from './client'

export interface DoctorProfile {
  id: string
  full_name: string
  specialization: string | null
  years_experience: number | null
  bio: string | null
  profile_photo_url: string | null
}

export type DoctorProfileUpdate = Pick<DoctorProfile, 'specialization' | 'years_experience' | 'bio'>

export async function getDoctors(filters: { search?: string; specialization?: string } = {}) {
  const { data } = await apiClient.get<DoctorProfile[]>('/doctors', { params: filters })
  return data
}

export async function getMyDoctorProfile() {
  const { data } = await apiClient.get<DoctorProfile>('/doctors/me/profile')
  return data
}

export async function updateMyDoctorProfile(payload: DoctorProfileUpdate) {
  const { data } = await apiClient.patch<DoctorProfile>('/doctors/me/profile', payload)
  return data
}

export async function uploadMyDoctorPhoto(photo: File) {
  const form = new FormData()
  form.append('photo', photo)
  const { data } = await apiClient.post<DoctorProfile>('/doctors/me/profile/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getDoctorPhoto(doctorId: string) {
  const { data } = await apiClient.get<Blob>(`/doctors/${doctorId}/photo`, { responseType: 'blob' })
  return data
}
