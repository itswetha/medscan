import { apiClient } from './client'

export interface UserNotification {
  id: string
  message: string
  is_read: boolean
  created_at: string
  scan_id: string | null
}

export async function getNotifications() {
  const { data } = await apiClient.get<UserNotification[]>('/notifications')
  return data
}

export async function getUnreadNotificationCount() {
  const { data } = await apiClient.get<{ unread_count: number }>('/notifications/unread-count')
  return data.unread_count
}

export async function markNotificationRead(notificationId: string) {
  const { data } = await apiClient.post<UserNotification>(`/notifications/${notificationId}/read`)
  return data
}
