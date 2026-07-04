import { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from 'react'
import api from '../api/client'

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
    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me/')
          .then(r => setUser(r.data))
          .catch(() => {
            localStorage.clear()
          })
          .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (phone_number: string, password: string) => {
    const { data } = await api.post('/auth/login/', { phone_number, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    setUser(data.user)
  }

  const register = async (formData: any) => {
    const { data } = await api.post('/auth/register/', formData)
    if (data.access) localStorage.setItem('access_token', data.access)
    if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
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
    const refresh = localStorage.getItem('refresh_token')
    if (refresh) {
      // Best-effort — blacklist the token server-side so it can't be reused
      api.post('/auth/logout/', { refresh }).catch(() => {})
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
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
