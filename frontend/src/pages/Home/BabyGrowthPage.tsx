import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowLeft, Ear, Heart, HeartPulse, Loader2, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageWrapper from '../../components/layout/PageWrapper'
import api from '../../api/client'
import './BabyGrowthPage.css'

interface GrowthRow {
  week: number
  trimester: '1st' | '2nd' | '3rd'
  emoji: string
  title: string
  title_sw: string
  description: string
  description_sw: string
  size_comparison: string
  size_comparison_sw: string
  length_cm: number | null
  baby_facts: string[]
  baby_facts_sw: string[]
  mother_feels: string[]
  mother_feels_sw: string[]
}

const TRIMESTER_KEY: Record<GrowthRow['trimester'], 'trimester.first' | 'trimester.second' | 'trimester.third'> = {
  '1st': 'trimester.first',
  '2nd': 'trimester.second',
  '3rd': 'trimester.third',
}

function closestRow(rows: GrowthRow[], week: number): GrowthRow {
  return rows.reduce((closest, item) =>
    Math.abs(item.week - week) < Math.abs(closest.week - week) ? item : closest
  , rows[0])
}

export default function BabyGrowthPage() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const isSwahili = i18n.language?.startsWith('sw')
  const [selectedWeek, setSelectedWeek] = useState(17)
  const [rows, setRows] = useState<GrowthRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get<GrowthRow[]>('/patients/baby-growth/')
      .then((res) => {
        if (cancelled) return
        if (Array.isArray(res.data) && res.data.length > 0) {
          setRows(res.data)
        } else {
          setError(t('bg_no_data'))
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('bg_load_failed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [t])

  const weekData = useMemo(() => (rows.length ? closestRow(rows, selectedWeek) : null), [rows, selectedWeek])

  if (loading) {
    return (
      <PageWrapper>
        <div className="growth-page growth-page-loading">
          <Loader2 className="growth-spinner" size={28} />
          <p>{t('bg_loading')}</p>
        </div>
      </PageWrapper>
    )
  }

  if (!weekData) {
    return (
      <PageWrapper>
        <div className="growth-page growth-page-loading">
          <p>{error || t('bg_no_data')}</p>
          <button className="btn-primary" onClick={() => nav('/home')}>{t('bg_back')}</button>
        </div>
      </PageWrapper>
    )
  }

  const displayWeek = selectedWeek
  const isExactWeek = weekData.week === selectedWeek
  const localized = isSwahili
    ? {
        size: weekData.size_comparison_sw || weekData.size_comparison,
        note: weekData.description_sw || weekData.description,
        babyFacts: weekData.baby_facts_sw?.length ? weekData.baby_facts_sw : weekData.baby_facts,
        motherFeels: weekData.mother_feels_sw?.length ? weekData.mother_feels_sw : weekData.mother_feels,
      }
    : {
        size: weekData.size_comparison,
        note: weekData.description,
        babyFacts: weekData.baby_facts,
        motherFeels: weekData.mother_feels,
      }
  const lengthDisplay = weekData.length_cm != null
    ? (isSwahili ? t('bg_length_sw', { cm: weekData.length_cm }) : t('bg_length_en', { cm: weekData.length_cm }))
    : ''
  const trimester = t(TRIMESTER_KEY[weekData.trimester] ?? 'trimester.first')

  const babyFacts = isExactWeek
    ? localized.babyFacts
    : [t('bg_preview_based', { week: weekData.week }), localized.note]

  return (
    <PageWrapper>
      <div className="growth-page">
        <header className="growth-header">
          <button className="growth-back" onClick={() => nav('/home')} aria-label={t('bg_back')}>
            <ArrowLeft size={19} />
          </button>
          <div className="growth-heading">
            <h1>{t('bg_title')}</h1>
            <p>{t('bg_week_trim', { week: displayWeek, trimester })}</p>
          </div>
          <div className="growth-header-emoji" role="img" aria-label={`${localized.size} size`}>
            {weekData.emoji}
          </div>
        </header>

        <section className="growth-hero">
          <p className="growth-eyebrow">{trimester}</p>
          <h2>{t('bg_week_label', { week: displayWeek })}</h2>
          <div className="growth-big-emoji" role="img" aria-label={`${localized.size} size`}>
            {weekData.emoji}
          </div>
          <p className="growth-size">{t('bg_size_of', { size: localized.size })}</p>
          {lengthDisplay && <p className="growth-length">{lengthDisplay}</p>}
        </section>

        <section className="growth-card">
          <div className="growth-slider-top">
            <p>{t('bg_explore')}</p>
            <span>{displayWeek}</span>
          </div>
          <input
            className="growth-slider"
            type="range"
            min="4"
            max="40"
            value={selectedWeek}
            onChange={(event) => setSelectedWeek(Number(event.target.value))}
            aria-label={t('bg_select_aria')}
          />
          <div className="growth-slider-labels">
            <span>4</span>
            <span>40</span>
          </div>
        </section>

        <section className="growth-card">
          <p className="growth-section-title">{t('bg_whats_happening')}</p>
          <p className="growth-note">{localized.note}</p>
          <div className="growth-list">
            {babyFacts.map((fact, index) => {
              const Icon = index === 0 ? Ear : ShieldCheck
              return (
                <div className="growth-list-item" key={fact}>
                  <span className="growth-list-icon baby"><Icon size={16} /></span>
                  <p>{fact}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="growth-card">
          <p className="growth-section-title">{t('bg_what_you_feel')}</p>
          <div className="growth-list">
            {localized.motherFeels.map((feeling, index) => {
              const Icon = index === 0 ? Heart : index === 1 ? Activity : HeartPulse
              return (
                <div className="growth-list-item" key={feeling}>
                  <span className="growth-list-icon mother"><Icon size={16} /></span>
                  <p>{feeling}</p>
                </div>
              )
            })}
          </div>
        </section>

        <div className="growth-loading-note">
          <Loader2 size={14} />
          {t('bg_low_data_note')}
        </div>
      </div>
    </PageWrapper>
  )
}
