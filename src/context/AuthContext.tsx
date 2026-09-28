import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, login as loginRequest, type User } from '../api/auth'
import { TOKEN_KEY, USER_KEY } from '../api/client'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredUser(): User | null {
  try {
    const value = localStorage.getItem(USER_KEY)
    return value ? (JSON.parse(value) as User) : null
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(() => readStoredUser())
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    setIsLoading(false)
  }

  useEffect(() => {
    const handleUnauthorized = () => logout()
    window.addEventListener('medscan:unauthorized', handleUnauthorized)

    if (!token) {
      localStorage.removeItem(USER_KEY)
      setUser(null)
      setIsLoading(false)
      return () => window.removeEventListener('medscan:unauthorized', handleUnauthorized)
    }

    let active = true
    setIsLoading(true)
    getCurrentUser()
      .then((currentUser) => {
        if (!active) return
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
        setUser(currentUser)
      })
      .catch(() => {
        if (active) logout()
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      window.removeEventListener('medscan:unauthorized', handleUnauthorized)
    }
    // Revalidate whenever the token changes, including after login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const login = async (email: string, password: string) => {
    const result = await loginRequest(email, password)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(result.user))
    setToken(result.access_token)
    setUser(result.user)
    return result.user
  }

  const value = useMemo(
    () => ({ user, token, isAuthenticated: Boolean(token && user && !isLoading), isLoading, login, logout }),
    [user, token, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
