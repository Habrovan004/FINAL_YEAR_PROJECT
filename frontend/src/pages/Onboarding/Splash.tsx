import { useNavigate } from 'react-router-dom'
import { Sparkles, ShieldCheck, Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import './auth.css'

export default function Splash() {
  const nav = useNavigate()
  const { dark, toggle } = useTheme()

  return (
      <div className="auth-page splash-page">
        {/* Dark mode toggle */}
        <button
            className="auth-theme-btn"
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Hero */}
        <div style={{ width: '100%', textAlign: 'center' }}>
          <div className="splash-logo" role="img" aria-label="Heart">💗</div>

          <div className="splash-hero">
            <h1 className="splash-title">
              Your pregnancy<br />companion
            </h1>
            <p className="splash-sub">
              Guidance, support, and care through every<br />
              stage — for you and your little one.
            </p>
          </div>

          <div className="splash-pills">
          <span className="splash-pill">
            <Sparkles size={13} /> Personalized
          </span>
            <span className="splash-pill">
            <ShieldCheck size={13} /> Trusted care
          </span>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="splash-bottom">
          <button className="btn-primary" onClick={() => nav('/onboarding')}>
            Get Started
          </button>
          <button className="btn-ghost" onClick={() => nav('/login')}>
            I already have an account
          </button>
        </div>
      </div>
  )
}
