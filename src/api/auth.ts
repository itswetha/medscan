import { apiClient } from './client'

export type UserRole = 'patient' | 'doctor' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  is_active: boolean
  role: UserRole
  created_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

export interface RegisterPayload {
  full_name: string
  email: string
  password: string
  role: Exclude<UserRole, 'admin'>
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password })
  return data
}

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<User>('/auth/register', payload)
  return data
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}
