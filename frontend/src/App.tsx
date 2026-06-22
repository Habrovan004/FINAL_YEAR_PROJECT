import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Languages, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'

// Global styles
import 'leaflet/dist/leaflet.css'

import Splash from './pages/Onboarding/Splash'
import Login from './pages/Onboarding/Login'
import OnboardingFlow from './pages/Onboarding/OnboardingFlow'
import VerifyOTP from './pages/Onboarding/VerifyOTP'
import SelectHospital from './pages/Onboarding/SelectHospital'
import PasswordResetRequest from './pages/Onboarding/PasswordResetRequest.tsx'
import PasswordResetConfirm from './pages/Onboarding/PasswordResetConfirm.tsx'
import HomePage from './pages/Home/HomePage'
import BabyGrowthPage from './pages/Home/BabyGrowthPage'
import TrackPage from './pages/Track/TrackPage'
import ContractionTimerPage from './pages/Track/ContractionTimerPage'
import TimelinePage from './pages/Timeline/TimelinePage'
import LearnPage from './pages/Learn/LearnPage'
import AppointmentsPage from './pages/Appointments/AppointmentsPage'
import ProfilePage from './pages/Profile/ProfilePage'
import EmergencyPage from './pages/Emergency/EmergencyPage'
import PartnerSupport from './pages/Profile/PartnerSupport'
import SettingsPage from './pages/Profile/SettingsPage'
import HospitalMap from './pages/Profile/HospitalMap'
import PreferencesPage from './pages/Profile/PreferencesPage'
import './App.css'

const queryClient = new QueryClient()

// ── ✅ FIX: PrivateRoute now checks is_verified correctly ─────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-rose-400 border-t-transparent rounded-full animate-spin" />
        </div>
    )
  }

  if (!user) return <Navigate to="/" replace />
  if (!user.is_verified) return <Navigate to="/onboarding/verify" replace />

  return <>{children}</>
}

// ── ✅ NEW: OnboardingRoute — must be logged in but not fully onboarded ────
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-rose-400 border-t-transparent rounded-full animate-spin" />
        </div>
    )
  }

  if (!user) return <Navigate to="/" replace />
  if (!user.is_verified) return <Navigate to="/onboarding/verify" replace />

  // If already onboarded, skip hospital selection
  if (user.is_onboarded) return <Navigate to="/home" replace />

  return <>{children}</>
}

function GlobalControls() {
  const { dark, toggle } = useTheme()
  const { i18n } = useTranslation()
  const activeLanguage = i18n.language?.startsWith('sw') ? 'sw' : 'en'

  const toggleLanguage = () => {
    const nextLanguage = activeLanguage === 'sw' ? 'en' : 'sw'
    void i18n.changeLanguage(nextLanguage)
    localStorage.setItem('mama-language', nextLanguage)
  }

  return (
    <div className="global-controls" aria-label="Display settings">
      <button
        type="button"
        className="global-control-btn"
        onClick={toggle}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <button
        type="button"
        className="global-language-btn"
        onClick={toggleLanguage}
        aria-label="Switch language"
      >
        <Languages size={15} />
        <span>{activeLanguage === 'sw' ? 'SW' : 'EN'}</span>
      </button>
    </div>
  )
}

function App() {
  return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* ── Public routes ── */}
                <Route path="/" element={<Splash />} />
                <Route path="/login" element={<Login />} />
                <Route path="/password-reset/request" element={<PasswordResetRequest />} />
                <Route path="/password-reset/confirm" element={<PasswordResetConfirm />} />
                <Route path="/onboarding" element={<OnboardingFlow />} />
                <Route path="/onboarding/verify" element={<VerifyOTP />} />

                {/* ── ✅ FIX: Hospital route is now protected ── */}
                <Route
                    path="/onboarding/hospital"
                    element={
                      <OnboardingRoute>
                        <SelectHospital />
                      </OnboardingRoute>
                    }
                />

                {/* ── Private routes ── */}
                <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
                <Route path="/baby-growth" element={<PrivateRoute><BabyGrowthPage /></PrivateRoute>} />
                <Route path="/track" element={<PrivateRoute><TrackPage /></PrivateRoute>} />
                <Route path="/track/contractions" element={<PrivateRoute><ContractionTimerPage /></PrivateRoute>} />
                <Route path="/timeline" element={<PrivateRoute><TimelinePage /></PrivateRoute>} />
                <Route path="/learn" element={<PrivateRoute><LearnPage /></PrivateRoute>} />
                <Route path="/appointments" element={<PrivateRoute><AppointmentsPage /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                <Route path="/profile/partner" element={<PrivateRoute><PartnerSupport /></PrivateRoute>} />
                <Route path="/profile/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
                <Route path="/profile/preferences" element={<PrivateRoute><PreferencesPage /></PrivateRoute>} />
                <Route path="/profile/hospitals" element={<PrivateRoute><HospitalMap /></PrivateRoute>} />
                <Route path="/emergency" element={<PrivateRoute><EmergencyPage /></PrivateRoute>} />

                {/* ── Fallback ── */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <GlobalControls />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
  )
}

export default App
