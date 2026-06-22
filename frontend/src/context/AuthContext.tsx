import { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from 'react'
import api from '../api/client'

// ── ✅ FIX: Added is_onboarded to User interface ──────────────────────────
interface User {
  id: number
  full_name: string
  phone_number: string
  user_type: string
  is_verified: boolean
  is_onboarded: boolean // ✅ Controls hospital selection redirect
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

  // ── Restore session on app load ───────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me/')
          .then(r => setUser(r.data))
          .catch(() => {
            // Token expired or invalid — clear storage
            localStorage.clear()
          })
          .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (phone_number: string, password: string) => {
    const { data } = await api.post('/auth/login/', { phone_number, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    setUser(data.user)
  }

  // ── Register ──────────────────────────────────────────────────────────────
  const register = async (formData: any) => {
    const { data } = await api.post('/auth/register/', formData)
    setUser(data.user)
  }

  // ── Refresh user data from backend ────────────────────────────────────────
  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me/')
      setUser(data)
    } catch (err) {
      console.error('Failed to refresh user:', err)
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.clear()
    setUser(null)
  }

  return (
      <AuthContext.Provider value={{ user, isLoading, login, register, logout, setUser, refreshUser }}>
        {children}
      </AuthContext.Provider>
  )
}