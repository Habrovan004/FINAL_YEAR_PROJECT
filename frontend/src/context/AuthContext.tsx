import { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from 'react'
import axios from 'axios'
import api from '../api/client'
import { setAccessToken } from '../api/tokenStore'

const SESSION_HINT_KEY = 'uzazi_has_session_hint'

function setSessionHint(value: boolean) {
  try {
    if (value) localStorage.setItem(SESSION_HINT_KEY, '1')
    else localStorage.removeItem(SESSION_HINT_KEY)
  } catch {
    // Ignore storage failures (private mode / disabled storage).
  }
}

function getSessionHint() {
  try {
    return document.cookie.includes('mama_session=1')
  } catch {
    return false
  }
}

// Session-bootstrap refresh is idempotent per page load — cache the in-flight
// promise at module scope (not component state) so React.StrictMode's dev-only
// double-invoke of this effect reuses the same request instead of firing a
// second concurrent POST with the same not-yet-rotated refresh cookie, which
// would otherwise race the first request to rotate/blacklist it server-side.
let bootstrapRefresh: Promise<{ data: { access: string } }> | null = null

interface User {
  id: number
  full_name: string
  phone_number: string
  email?: string | null
  user_type: 'patient' | 'provider' | string
  is_verified: boolean
  is_onboarded: boolean
  hospital_id?: number | null
  hospital_name?: string | null
  has_assigned_provider?: boolean
}

interface AuthCtx {
  user: User | null
  isLoading: boolean
  login: (phone: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
  setUser: (user: User | null) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Skip refresh bootstrap for clearly anonymous sessions.
    if (!getSessionHint()) {
      setIsLoading(false)
      return () => { cancelled = true }
    }

    // The access token only ever lives in memory, so a page reload loses it.
    // Recover a session by exchanging the httpOnly refresh cookie (if any).
    // Must bypass `api`'s 401-retry interceptor: a visitor with no cookie
    // yet is an expected 401 here, not a mid-session expiry — going through
    // `api` would make the interceptor "retry" this exact call, also get
    // 401, and force a redirect to '/', which remounts this effect and
    // loops forever.
    if (!bootstrapRefresh) {
      bootstrapRefresh = axios.post(
        `${import.meta.env.VITE_API_URL}/auth/token/refresh/`, {}, { withCredentials: true }
      )
    }

    bootstrapRefresh
        .then(r => {
          if (cancelled) return
          setAccessToken(r.data.access)
          setSessionHint(true)
          return api.get('/auth/me/').then(res => setUser(res.data))
        })
        .catch(() => {
          if (!cancelled) {
            setAccessToken(null)
            setSessionHint(false)
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })

    return () => { cancelled = true }
  }, [])

  const login = async (phone_number: string, password: string) => {
    const { data } = await api.post('/auth/login/', { phone_number, password })
    setAccessToken(data.access)
    setSessionHint(true)
    setUser(data.user)
  }

  const register = async (formData: any) => {
    const { data } = await api.post('/auth/register/', formData)
    setAccessToken(data.access)
    setSessionHint(true)
    setUser(data.user)
  }

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me/')
      setUser(data)
    } catch (err) {
      console.error('Failed to refresh user:', err)
    }
  }

  const logout = () => {
    // Best-effort — blacklist the token server-side so it can't be reused.
    // The refresh token travels via the httpOnly cookie, not the body.
    api.post('/auth/logout/').catch(() => {})
    setAccessToken(null)
    setSessionHint(false)
    setUser(null)
  }

  return (
      <AuthContext.Provider value={{ user, isLoading, login, register, logout, setUser, refreshUser }}>
        {children}
      </AuthContext.Provider>
  )
}

export function dashboardPathFor(userType?: string) {
  if (userType === 'provider') return '/provider/dashboard'
  return '/home'
}
