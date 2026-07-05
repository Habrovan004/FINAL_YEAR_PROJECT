import { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from 'react'
import axios from 'axios'
import api from '../api/client'
import { setAccessToken } from '../api/tokenStore'

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
    // The access token only ever lives in memory, so a page reload loses it.
    // Recover a session by exchanging the httpOnly refresh cookie (if any).
    // Must bypass `api`'s 401-retry interceptor: a visitor with no cookie
    // yet is an expected 401 here, not a mid-session expiry — going through
    // `api` would make the interceptor "retry" this exact call, also get
    // 401, and force a redirect to '/', which remounts this effect and
    // loops forever.
    axios.post(
      `${import.meta.env.VITE_API_URL}/auth/token/refresh/`, {}, { withCredentials: true }
    )
        .then(r => {
          setAccessToken(r.data.access)
          return api.get('/auth/me/')
        })
        .then(r => setUser(r.data))
        .catch(() => {
          setAccessToken(null)
        })
        .finally(() => setIsLoading(false))
  }, [])

  const login = async (phone_number: string, password: string) => {
    const { data } = await api.post('/auth/login/', { phone_number, password })
    setAccessToken(data.access)
    setUser(data.user)
  }

  const register = async (formData: any) => {
    const { data } = await api.post('/auth/register/', formData)
    setAccessToken(data.access)
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
