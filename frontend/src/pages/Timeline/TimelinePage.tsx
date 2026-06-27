import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Loader2, TrendingUp, TrendingDown, Calendar, Weight,
  Smile, Activity, BookOpen, Sparkles, PlusCircle
} from 'lucide-react'
import {
  XAxis, ResponsiveContainer, Tooltip, Area, AreaChart, YAxis, CartesianGrid,
  BarChart, Bar
} from 'recharts'
import api from '../../api/client'
import { useTheme } from '../../context/ThemeContext'
import './TimelinePage.css'

interface Log {
  id: number;
  mood: number;
  mood_label: string;
  symptoms: string[];
  notes: string;
  date: string;
  weight_kg: number | null;
}

interface TimelineData {
  mood_logs: Log[];
  weight_history: { date: string; weight_kg: number }[];
  summary: {
    avg_mood: number | null;
    last_weight: number | null;
  };
}

type Tab = 'mood' | 'weight' | 'symptoms'

const MOODS = [
  { val: 5, emoji: '😄', key: 'mood_great' },
  { val: 4, emoji: '😊', key: 'mood_good' },
  { val: 3, emoji: '😐', key: 'mood_okay' },
  { val: 2, emoji: '😟', key: 'mood_not_well' },
  { val: 1, emoji: '😢', key: 'mood_bad' },
]

const moodKeyFor = (val: number) => MOODS.find(m => m.val === val)?.key ?? 'mood_okay'
const moodEmojiFor = (val: number) => MOODS.find(m => m.val === val)?.emoji ?? '😐'

export default function TimelinePage() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const { dark } = useTheme()
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('mood')

  useEffect(() => {
    let cancelled = false
    const fetchTimeline = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await api.get('/tracking/timeline/')
        if (!cancelled) setData(response.data)
      } catch (e) {
        console.error('Error fetching timeline:', e)
        if (!cancelled) setError(t('timeline_load_failed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchTimeline()
    return () => { cancelled = true }
  }, [t])

  const localeForDates = i18n.language?.startsWith('sw') ? 'sw' : 'en'

  const moodChartData = useMemo(
    () => (data?.mood_logs || [])
      .slice()
      .reverse()
      .map(l => ({
        day: new Date(l.date).toLocaleDateString(localeForDates, { weekday: 'short' }),
        mood: l.mood,
      })),
    [data, localeForDates]
  )

  const weightChartData = useMemo(
    () => (data?.weight_history || []).map(w => ({
      date: new Date(w.date).toLocaleDateString(localeForDates, { month: 'short', day: 'numeric' }),
      weight: w.weight_kg,
    })),
    [data, localeForDates]
  )

  const symptomCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const log of data?.mood_logs || []) {
      for (const s of log.symptoms || []) {
        counts.set(s, (counts.get(s) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [data])

  const weightTrend = useMemo(() => {
    const list = data?.weight_history || []
    if (list.length < 2) return null
    const diff = list[list.length - 1].weight_kg - list[0].weight_kg
    return { diff, isUp: diff >= 0 }
  }, [data])

  const accent = 'var(--accent)'
  const accentSoft = dark ? 'rgba(237, 147, 177, 0.25)' : 'rgba(212, 83, 126, 0.18)'
  const gridStroke = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'
  const axisColor = dark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.45)'
  const tooltipStyle = {
    borderRadius: 14,
    border: '0.5px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    boxShadow: '0 12px 28px rgba(15,23,42,0.12)',
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 12px',
  } as const

  if (loading) {
    return (
      <div className="tl-loader">
        <Loader2 className="tl-spin" size={28} />
      </div>
    )
  }

  const avgMood = data?.summary.avg_mood
  const lastWeight = data?.summary.last_weight

  return (
    <div className="tl-page">
      <div className="tl-inner">
        {/* Header */}
        <header className="tl-header">
          <button className="back-btn" onClick={() => nav('/home')} aria-label={t('back')}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="tl-title">{t('health_progress')}</h1>
          <span className="tl-header-spacer" aria-hidden="true" />
        </header>

        {error && (
          <div className="tl-error" role="alert">{error}</div>
        )}

        {/* Summary stats */}
        <div className="tl-stats">
          <div className="tl-stat-card tl-stat-mood">
            <div className="tl-stat-icon"><Smile size={18} /></div>
            <div className="tl-stat-body">
              <p className="tl-stat-label">{t('avg_mood')}</p>
              <div className="tl-stat-value-row">
                <span className="tl-stat-value">
                  {avgMood != null ? avgMood.toFixed(1) : '—'}
                </span>
                <span className="tl-stat-unit">/ 5</span>
              </div>
              <p className="tl-stat-meta">
                {avgMood != null ? `${moodEmojiFor(Math.round(avgMood))} ${t(moodKeyFor(Math.round(avgMood)))}` : t('no_data_yet')}
              </p>
            </div>
          </div>

          <div className="tl-stat-card tl-stat-weight">
            <div className="tl-stat-icon"><Weight size={18} /></div>
            <div className="tl-stat-body">
              <p className="tl-stat-label">{t('last_weight')}</p>
              <div className="tl-stat-value-row">
                <span className="tl-stat-value">
                  {lastWeight != null ? lastWeight : '—'}
                </span>
                <span className="tl-stat-unit">kg</span>
              </div>
              <p className="tl-stat-meta">
                {weightTrend ? (
                  <span className={`tl-trend ${weightTrend.isUp ? 'up' : 'down'}`}>
                    {weightTrend.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(weightTrend.diff).toFixed(1)} kg {t('since_first_log')}
                  </span>
                ) : (
                  t('no_data_yet')
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tl-tabs" role="tablist" aria-label={t('health_progress')}>
          {(['mood', 'weight', 'symptoms'] as const).map(key => {
            const Icon = key === 'mood' ? Smile : key === 'weight' ? Weight : Activity
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`tl-tab ${tab === key ? 'active' : ''}`}
              >
                <Icon size={14} />
                <span>{t(`tab_${key}`)}</span>
              </button>
            )
          })}
        </div>

        {/* Chart */}
        <section className="tl-chart-card" aria-live="polite">
          {tab === 'mood' && (
            <>
              <div className="tl-chart-head">
                <div>
                  <h3 className="tl-chart-title">{t('mood_trends')}</h3>
                  <p className="tl-chart-sub">{t('mood_trends_sub')}</p>
                </div>
                <span className="tl-chip">{t('last_7_days')}</span>
              </div>
              <div className="tl-chart-body">
                {moodChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={moodChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tlMoodGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                      <YAxis hide domain={[1, 5]} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ stroke: accentSoft, strokeWidth: 1 }}
                        formatter={(v: number) => [t(moodKeyFor(v)), t('status')]}
                      />
                      <Area
                        type="monotone"
                        dataKey="mood"
                        stroke={accent}
                        strokeWidth={3}
                        fill="url(#tlMoodGrad)"
                        dot={{ fill: 'var(--accent)', r: 4, strokeWidth: 2, stroke: 'var(--bg-card)' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty icon={<Calendar size={28} />} text={t('no_mood_data')} />
                )}
              </div>
            </>
          )}

          {tab === 'weight' && (
            <>
              <div className="tl-chart-head">
                <div>
                  <h3 className="tl-chart-title">{t('weight_gain_kg')}</h3>
                  <p className="tl-chart-sub">{t('weight_trends_sub')}</p>
                </div>
                <span className="tl-chip tl-chip-blue">
                  <TrendingUp size={12} /> {t('progress')}
                </span>
              </div>
              <div className="tl-chart-body">
                {weightChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={weightChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tlWeightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                      <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ stroke: '#3b82f6', strokeOpacity: 0.25, strokeWidth: 1 }}
                        formatter={(v: number) => [`${v} kg`, t('weight_label')]}
                      />
                      <Area
                        type="monotone"
                        dataKey="weight"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fill="url(#tlWeightGrad)"
                        dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: 'var(--bg-card)' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty icon={<TrendingUp size={28} />} text={t('no_weight_data')} />
                )}
              </div>
            </>
          )}

          {tab === 'symptoms' && (
            <>
              <div className="tl-chart-head">
                <div>
                  <h3 className="tl-chart-title">{t('symptom_frequency')}</h3>
                  <p className="tl-chart-sub">{t('symptom_frequency_sub')}</p>
                </div>
                <span className="tl-chip tl-chip-purple">
                  <Activity size={12} /> {t('top_5')}
                </span>
              </div>
              <div className="tl-chart-body">
                {symptomCounts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={symptomCounts.slice(0, 5)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: accentSoft }}
                        formatter={(v: number) => [v, t('logs_count')]}
                      />
                      <Bar dataKey="count" fill="var(--accent)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty icon={<Activity size={28} />} text={t('no_symptoms_data')} />
                )}
              </div>
            </>
          )}
        </section>

        {/* Journal */}
        <div className="tl-journal-head">
          <h3 className="tl-journal-title">
            <BookOpen size={16} /> {t('journal_history')}
          </h3>
          {data?.mood_logs && data.mood_logs.length > 0 && (
            <button className="tl-journal-add" onClick={() => nav('/track')}>
              <PlusCircle size={14} /> {t('new_entry')}
            </button>
          )}
        </div>

        <div className="tl-journal-list">
          {data?.mood_logs && data.mood_logs.length > 0 ? (
            data.mood_logs.map(log => (
              <article key={log.id} className="tl-entry">
                <header className="tl-entry-head">
                  <div>
                    <p className="tl-entry-date">
                      {new Date(log.date).toLocaleDateString(localeForDates, {
                        weekday: 'long', month: 'short', day: 'numeric',
                      })}
                    </p>
                    <p className="tl-entry-mood">{t(moodKeyFor(log.mood))}</p>
                  </div>
                  <span className="tl-entry-emoji" aria-hidden="true">{moodEmojiFor(log.mood)}</span>
                </header>

                {log.symptoms && log.symptoms.length > 0 && (
                  <div className="tl-entry-chips">
                    {log.symptoms.map(s => (
                      <span key={s} className="tl-entry-chip">{s}</span>
                    ))}
                  </div>
                )}

                {log.notes && (
                  <div className="tl-entry-notes">
                    <p>&ldquo;{log.notes}&rdquo;</p>
                  </div>
                )}

                {log.weight_kg && (
                  <div className="tl-entry-weight">
                    <Weight size={12} />
                    <span>{log.weight_kg} kg {t('recorded')}</span>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="tl-empty">
              <div className="tl-empty-bubble" aria-hidden="true">
                <Sparkles size={26} />
              </div>
              <h4 className="tl-empty-title">{t('empty_journal_title')}</h4>
              <p className="tl-empty-sub">{t('empty_journal_sub')}</p>
              <button className="btn-primary tl-empty-cta" onClick={() => nav('/track')}>
                <PlusCircle size={16} /> {t('start_first_entry')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ChartEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="tl-chart-empty">
      <div className="tl-chart-empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  )
}
