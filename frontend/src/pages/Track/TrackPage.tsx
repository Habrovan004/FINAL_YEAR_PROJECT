import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Clock, Loader2, Scale, FileText } from 'lucide-react'
import api from '../../api/client'
import '../Onboarding/auth.css'
import './TrackPage.css'

interface Symptom {
  id: number
  name: string
  name_sw: string
  icon: string
}

export default function TrackPage() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const isSwahili = i18n.language?.startsWith('sw')

  const MOODS = [
    { val: 5, emoji: '😄', label: t('mood_great') },
    { val: 4, emoji: '😊', label: t('mood_good') },
    { val: 3, emoji: '😐', label: t('mood_okay') },
    { val: 2, emoji: '😟', label: t('mood_not_well') },
    { val: 1, emoji: '😢', label: t('mood_bad') },
  ]

  const [mood, setMood]             = useState<number | null>(null)
  const [symptomIds, setSymptomIds] = useState<number[]>([])
  const [available, setAvailable]   = useState<Symptom[]>([])
  const [weight, setWeight]         = useState('')
  const [notes, setNotes]           = useState('')
  const [saved, setSaved]           = useState(false)
  const [loading, setLoading]       = useState(false)
  const [fetching, setFetching]     = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    api.get('/tracking/symptoms/')
        .then(r => setAvailable(r.data))
        .catch(() => {
          const fallback = ['Nausea', 'Headache', 'Tiredness', 'Heartburn', 'Back pain', 'Swelling (feet/ankles)', 'Cravings']
              .map((name, id) => ({ id, name, name_sw: '', icon: '' }))
          setAvailable(fallback)
        })
        .finally(() => setFetching(false))
  }, [])

  // Pick the right label per symptom for the active language.
  // Prefer backend-provided `name_sw`, then i18n dictionary fallback, then English name.
  const symptomLabel = (s: Symptom) => {
    if (isSwahili) {
      if (s.name_sw && s.name_sw.trim()) return s.name_sw
      const fromDict = t(`symptom.${s.name}`, { defaultValue: s.name })
      return fromDict
    }
    return s.name
  }

  const toggleSymptom = (id: number) =>
      setSymptomIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const save = async () => {
    if (!mood) {
      setError(t('track_err_mood'))
      return
    }

    const parsedWeight = weight.trim() ? Number(weight) : null
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      setError(t('track_err_weight'))
      return
    }

    setError('')
    setLoading(true)
    try {
      await api.post('/tracking/', {
        mood,
        symptoms: symptomIds,
        notes,
        weight_kg: parsedWeight,
      })
      setSaved(true)
      setTimeout(() => nav('/timeline'), 1600)
    } catch (e) {
      console.error('Error saving daily record', e)
      setError(t('track_err_generic'))
    } finally {
      setLoading(false)
    }
  }

  if (saved) {
    return (
        <div className="track-saved">
          <div className="saved-bubble" role="img" aria-label="Success">💚</div>
          <h2 className="saved-title">{t('track_saved_title')}</h2>
          <p className="saved-sub">{t('track_saved_sub')}</p>
        </div>
    )
  }

  return (
      <div className="track-page">
        <div className="track-inner">

          <header className="track-header">
            <button className="back-btn" onClick={() => nav('/home')} aria-label={t('track_back')}>
              <ArrowLeft size={18} />
            </button>
            <h1 className="track-title">{t('track_title')}</h1>
            <span className="track-header-spacer" aria-hidden="true" />
          </header>

          <button className="track-card track-tool-card" onClick={() => nav('/track/contractions')}>
            <div className="track-tool-icon">
              <Clock size={20} />
            </div>
            <div>
              <p className="track-card-title">{t('track_contraction_timer')}</p>
              <p className="track-card-sub">{t('track_contraction_sub')}</p>
            </div>
          </button>

          <div className="track-card">
            <p className="track-card-title">{t('track_mood_title')}</p>
            <p className="track-card-sub">{t('track_mood_sub')}</p>
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

          <div className="track-card">
            <p className="track-card-title">
              <Scale size={16} style={{ color: 'var(--accent)' }} />
              {t('track_weight_title')}
            </p>
            <p className="track-card-sub">{t('track_weight_sub')}</p>
            <div className="weight-wrap">
              <span className="weight-prefix">kg</span>
              <input
                  className="weight-input"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder={t('track_weight_placeholder')}
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
              />
            </div>
          </div>

          <div className="track-card">
            <p className="track-card-title">{t('track_symptoms_title')}</p>
            <p className="track-card-sub">{t('track_symptoms_sub')}</p>
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
                        {symptomLabel(s)}
                      </button>
                  ))}
                </div>
            )}
          </div>

          <div className="track-card">
            <p className="track-card-title">
              <FileText size={16} style={{ color: 'var(--accent)' }} />
              {t('track_notes_title')}
            </p>
            <p className="track-card-sub">{t('track_notes_sub')}</p>
            <textarea
                className="notes-textarea"
                placeholder={t('track_notes_placeholder')}
                value={notes}
                onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && (
              <div className="track-error" role="alert">
                {error}
              </div>
          )}

          <div className="track-cta">
            <button
                className="btn-primary"
                onClick={save}
                disabled={!mood || loading}
            >
              {loading
                  ? <><Loader2 size={16} className="track-spin" /> {t('track_saving')}</>
                  : t('track_save_btn')}
            </button>
          </div>

        </div>
      </div>
  )
}
