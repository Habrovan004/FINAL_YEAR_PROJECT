import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Loader2, Scale, FileText, Moon, Sun } from 'lucide-react'
import api from '../../api/client'
import { useTheme } from '../../context/ThemeContext'
import '../Onboarding/auth.css' // Corrected import path
import './TrackPage.css'

const MOODS = [
  { val: 5, emoji: '😄', label: 'Great' },
  { val: 4, emoji: '😊', label: 'Good' },
  { val: 3, emoji: '😐', label: 'Okay' },
  { val: 2, emoji: '😟', label: 'Not well' },
  { val: 1, emoji: '😢', label: 'Bad' },
]

interface Symptom {
  id: number
  name: string
  name_sw: string
  icon: string
}

export default function TrackPage() {
  const nav = useNavigate()
  const { dark, toggle } = useTheme()

  const [mood, setMood]           = useState<number | null>(null)
  const [symptomIds, setSymptomIds] = useState<number[]>([]) // Changed to store IDs
  const [available, setAvailable] = useState<Symptom[]>([])
  const [weight, setWeight]       = useState('')
  const [notes, setNotes]         = useState('')
  const [saved, setSaved]         = useState(false)
  const [loading, setLoading]     = useState(false)
  const [fetching, setFetching]   = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    api.get('/tracking/symptoms/')
        .then(r => setAvailable(r.data))
        .catch(() => {
          const fallback = ['Nausea', 'Headache', 'Tiredness', 'Heartburn', 'Back pain', 'Swelling', 'Cravings']
              .map((name, id) => ({ id, name, name_sw: name, icon: '' }))
          setAvailable(fallback)
        })
        .finally(() => setFetching(false))
  }, [])

  const toggleSymptom = (id: number) =>
      setSymptomIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const save = async () => {
    if (!mood) {
      setError('Choose your mood before saving your daily record.')
      return
    }

    const parsedWeight = weight.trim() ? Number(weight) : null
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      setError('Enter a valid weight in kilograms, or leave it blank.')
      return
    }

    setError('')
    setLoading(true)
    try {
      await api.post('/tracking/', {
        mood,
        symptoms: symptomIds, // Send IDs
        notes,
        weight_kg: parsedWeight,
      })
      setSaved(true)
      setTimeout(() => nav('/timeline'), 1600)
    } catch (e) {
      console.error('Error saving daily record', e)
      setError('Could not save your daily record. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Saved success state ── */
  if (saved) {
    return (
        <div className="track-saved">
          <div className="saved-bubble" role="img" aria-label="Success">💚</div>
          <h2 className="saved-title">Well done!</h2>
          <p className="saved-sub">
            Your health data has been successfully recorded for today.
          </p>
        </div>
    )
  }

  return (
      <div className="track-page">
        <div className="track-inner">

          {/* ── Header ── */}
          <header className="track-header">
            <button className="back-btn" onClick={() => nav('/home')} aria-label="Go back">
              <ArrowLeft size={18} />
            </button>
            <h1 className="track-title">Daily Check-in</h1>
            <div className="header-controls">
              <button
                  className="icon-btn"
                  onClick={toggle}
                  aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
          </header>

          <button className="track-card track-tool-card" onClick={() => nav('/track/contractions')}>
            <div className="track-tool-icon">
              <Clock size={20} />
            </div>
            <div>
              <p className="track-card-title">Contraction Timer</p>
              <p className="track-card-sub">Track labour contractions and the 5-1-1 pattern.</p>
            </div>
          </button>

          {/* ── Mood card ── */}
          <div className="track-card">
            <p className="track-card-title">How's your mood today?</p>
            <p className="track-card-sub">
              Emotional health is just as important as physical health.
            </p>
            <div className="mood-row">
              {MOODS.map(m => (
                  <button
                      key={m.val}
                      className={`mood-btn${mood === m.val ? ' active' : ''}`}
                      onClick={() => setMood(m.val)}
                      aria-label={m.label}
                      aria-pressed={mood === m.val}
                  >
                    <span className="mood-emoji">{m.emoji}</span>
                    <span className="mood-label">{m.label}</span>
                  </button>
              ))}
            </div>
          </div>

          {/* ── Weight card ── */}
          <div className="track-card">
            <p className="track-card-title">
              <Scale size={16} style={{ color: 'var(--accent)' }} />
              Weight monitoring
            </p>
            <p className="track-card-sub">
              Tracking your weight helps monitor your baby's growth.
            </p>
            <div className="weight-wrap">
              <span className="weight-prefix">kg</span>
              <input
                  className="weight-input"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 65.5"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
              />
            </div>
          </div>

          {/* ── Symptoms card ── */}
          <div className="track-card">
            <p className="track-card-title">Any symptoms today?</p>
            <p className="track-card-sub">Select anything you've felt today.</p>
            {fetching ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                  <Loader2 size={24} className="track-spin" style={{ color: 'var(--accent)' }} />
                </div>
            ) : (
                <div className="symptom-chips">
                  {available.map(s => (
                      <button
                          key={s.id}
                          className={`symptom-chip${symptomIds.includes(s.id) ? ' active' : ''}`}
                          onClick={() => toggleSymptom(s.id)}
                          aria-pressed={symptomIds.includes(s.id)}
                      >
                        {s.name}
                      </button>
                  ))}
                </div>
            )}
          </div>

          {/* ── Notes card ── */}
          <div className="track-card">
            <p className="track-card-title">
              <FileText size={16} style={{ color: 'var(--accent)' }} />
              Notes
            </p>
            <p className="track-card-sub">
              Any questions for your next clinic visit?
            </p>
            <textarea
                className="notes-textarea"
                placeholder="Write down anything on your mind…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && (
              <div className="track-error" role="alert">
                {error}
              </div>
          )}

          {/* ── CTA ── */}
          <div className="track-cta">
            <button
                className="btn-primary"
                onClick={save}
                disabled={!mood || loading}
            >
              {loading
                  ? <><Loader2 size={16} className="track-spin" /> Saving…</>
                  : 'Save Daily Record'}
            </button>
          </div>

        </div>
      </div>
  )
}
