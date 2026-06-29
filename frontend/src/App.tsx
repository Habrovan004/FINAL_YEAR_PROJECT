import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Languages, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AuthProvider, useAuth, dashboardPathFor } from './context/AuthContext'
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
import ChatPage from './pages/Chat/ChatPage'
import ProviderDashboard from './pages/Provider/ProviderDashboard'
import ProviderChatQueue from './pages/Provider/ProviderChatQueue'
import ManagerDashboard from './pages/Manager/ManagerDashboard'
import './App.css'

const queryClient = new QueryClient()

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-rose-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// PrivateRoute now restricts by role and routes other roles to their own dashboard
function PrivateRoute({ children, allow }: { children: React.ReactNode; allow?: string[] }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/" replace />
  if (!user.is_verified) return <Navigate to="/onboarding/verify" replace />
  if (allow && !allow.includes(user.user_type)) {
    return <Navigate to={dashboardPathFor(user.user_type)} replace />
  }
  return <>{children}</>
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/" replace />
  if (!user.is_verified) return <Navigate to="/onboarding/verify" replace />
  if (user.user_type !== 'patient') {
    return <Navigate to={dashboardPathFor(user.user_type)} replace />
  }
  if (user.is_onboarded) return <Navigate to="/home" replace />
  return <>{children}</>
}

const ONBOARDING_PATH_PREFIXES = ['/onboarding', '/login', '/password-reset']

function GlobalControls() {
  const { dark, toggle } = useTheme()
  const { i18n } = useTranslation()
  const location = useLocation()
  const activeLanguage = i18n.language?.startsWith('sw') ? 'sw' : 'en'

  const isOnboarding =
    location.pathname === '/' ||
    ONBOARDING_PATH_PREFIXES.some(prefix => location.pathname.startsWith(prefix))

  // Pages that render their own theme / language toggles in the header row.
  const PAGES_WITH_OWN_CONTROLS = ['/provider/dashboard', '/manager/dashboard']
  if (PAGES_WITH_OWN_CONTROLS.includes(location.pathname)) return null

  const toggleLanguage = () => {
    const nextLanguage = activeLanguage === 'sw' ? 'en' : 'sw'
    void i18n.changeLanguage(nextLanguage)
  }

  return (
    <div
      className={`global-controls${isOnboarding ? ' global-controls--top' : ''}`}
      aria-label="Display settings"
    >
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

                {/* ── Mother onboarding (hospital pick) ── */}
                <Route
                    path="/onboarding/hospital"
                    element={
                      <OnboardingRoute>
                        <SelectHospital />
                      </OnboardingRoute>
                    }
                />

                {/* ── Mother (patient) routes ── */}
                <Route path="/home" element={<PrivateRoute allow={['patient']}><HomePage /></PrivateRoute>} />
                <Route path="/baby-growth" element={<PrivateRoute allow={['patient']}><BabyGrowthPage /></PrivateRoute>} />
                <Route path="/track" element={<PrivateRoute allow={['patient']}><TrackPage /></PrivateRoute>} />
                <Route path="/track/contractions" element={<PrivateRoute allow={['patient']}><ContractionTimerPage /></PrivateRoute>} />
                <Route path="/timeline" element={<PrivateRoute allow={['patient']}><TimelinePage /></PrivateRoute>} />
                <Route path="/learn" element={<PrivateRoute allow={['patient']}><LearnPage /></PrivateRoute>} />
                <Route path="/appointments" element={<PrivateRoute allow={['patient']}><AppointmentsPage /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute allow={['patient']}><ProfilePage /></PrivateRoute>} />
                <Route path="/profile/partner" element={<PrivateRoute allow={['patient']}><PartnerSupport /></PrivateRoute>} />
                <Route path="/profile/settings" element={<PrivateRoute allow={['patient']}><SettingsPage /></PrivateRoute>} />
                <Route path="/profile/preferences" element={<PrivateRoute allow={['patient']}><PreferencesPage /></PrivateRoute>} />
                <Route path="/profile/hospitals" element={<PrivateRoute allow={['patient']}><HospitalMap /></PrivateRoute>} />
                <Route path="/emergency" element={<PrivateRoute allow={['patient']}><EmergencyPage /></PrivateRoute>} />
                <Route path="/chat" element={<PrivateRoute allow={['patient']}><ChatPage /></PrivateRoute>} />

                {/* ── Provider routes ── */}
                <Route path="/provider/dashboard" element={<PrivateRoute allow={['provider']}><ProviderDashboard /></PrivateRoute>} />
                <Route path="/provider/chats" element={<PrivateRoute allow={['provider']}><ProviderChatQueue /></PrivateRoute>} />

                {/* ── Hospital Manager routes ── */}
                <Route path="/manager/dashboard" element={<PrivateRoute allow={['hospital_manager']}><ManagerDashboard /></PrivateRoute>} />

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
