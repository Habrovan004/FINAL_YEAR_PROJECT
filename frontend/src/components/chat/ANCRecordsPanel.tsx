import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'

export interface ANCVisitRecord {
  id: number
  visit_date: string
  gestational_age_weeks: number
  blood_pressure_systolic: number
  blood_pressure_diastolic: number
  weight_kg: number
  hemoglobin_g_dl: number | null
  risk_level: 'low' | 'medium' | 'high'
  complications_display: string
  next_appointment_date: string | null
}

interface ANCRecordsPanelProps {
  open: boolean
  motherId: number | undefined
  onClose: () => void
  onInsert: (visit: ANCVisitRecord) => void | Promise<void>
  insertingVisitId: number | null
  /** Set by the parent when `onInsert` fails — displayed alongside any
   * fetch error, since both are "something went wrong in this panel". */
  insertError?: string
}

/** Slide-over showing a mother's ANC visit history, with tap-to-insert into
 * the active chat thread as a structured summary card. Shared between the
 * provider's escalated (AI) thread and direct-message thread views — each
 * supplies its own `onInsert` since the two threads post to different
 * backend endpoints/message shapes.
 */
export default function ANCRecordsPanel({ open, motherId, onClose, onInsert, insertingVisitId, insertError }: ANCRecordsPanelProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('sw') ? 'sw' : 'en'
  const [records, setRecords] = useState<ANCVisitRecord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setRecords(null)
    setError('')
    if (!motherId) return
    setLoading(true)
    api.get(`/clinical/summary/${motherId}/`)
      .then(r => setRecords(r.data.history || []))
      .catch(() => setError(t('anc_records_load_error')))
      .finally(() => setLoading(false))
  }, [open, motherId, t])

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 320, maxWidth: '92vw',
          background: 'var(--pv-card)', overflowY: 'auto', padding: '20px 16px',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.14)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: '0.625rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4537E', fontWeight: 700, margin: 0 }}>
            {t('anc_records_title')}
          </p>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--pv-chip-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pv-text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {(error || insertError) && (
          <p style={{ fontSize: 12, color: 'var(--pv-error)', marginBottom: 10 }}>{error || insertError}</p>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <Loader2 size={26} className="provider-spin" />
          </div>
        ) : !records || records.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--pv-text-muted)', textAlign: 'center', padding: '20px 0' }}>
            {t('provider_no_visits_recorded')}
          </p>
        ) : (
          records.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => void onInsert(v)}
              disabled={insertingVisitId === v.id}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                borderRadius: 10, border: '0.5px solid var(--pv-border)',
                padding: '10px 12px', marginBottom: 8, background: 'transparent',
                cursor: insertingVisitId === v.id ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--pv-text)' }}>
                  {new Date(v.visit_date).toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' })} · {t('visit_card_week').toLowerCase()} {v.gestational_age_weeks}
                </span>
                {insertingVisitId === v.id ? (
                  <Loader2 size={12} className="provider-spin" />
                ) : (
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase',
                    color: v.risk_level === 'high' ? '#dc2626' : v.risk_level === 'medium' ? '#d97706' : '#16a34a',
                  }}>
                    {v.risk_level}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.6875rem', color: 'var(--pv-text-muted)', margin: 0 }}>
                BP {v.blood_pressure_systolic}/{v.blood_pressure_diastolic} mmHg · {v.weight_kg} kg
                {v.hemoglobin_g_dl != null && ` · Hb ${v.hemoglobin_g_dl}`}
              </p>
              <p style={{ fontSize: '0.625rem', color: 'var(--pv-text-muted)', margin: '3px 0 0' }}>
                {t('anc_records_tap_to_insert')}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
