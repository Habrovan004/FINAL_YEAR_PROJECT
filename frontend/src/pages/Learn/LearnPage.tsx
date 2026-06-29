import { useState, useEffect, useCallback, useMemo } from 'react'
import { Volume2, Bookmark, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import PageWrapper from '../../components/layout/PageWrapper'
import api from '../../api/client'

interface Article {
  id: number
  title: string
  title_sw: string
  description: string
  description_sw: string
  is_bookmarked: boolean
  category: number | null
  tip_type: string
  trimester: string         // "1" | "2" | "3" | "all"
}

const CATEGORIES = [
  { label: 'what_to_do',       icon: '🍎', color: '#ffe4e6' },
  { label: 'what_to_avoid',    icon: '⚠️', color: '#ffe4e6' },
  { label: 'warning_signs',    icon: '💛', color: '#fef9c3' },
  { label: 'hormonal_changes', icon: '✨', color: '#ede9fe' },
  { label: 'birth_prep',       icon: '🐣', color: '#fce7f3' },
  { label: 'nutrition',        icon: '🥗', color: '#dcfce7' },
]

// Backend dashboard returns trimester as a string like "1st" / "2nd" / "3rd" / "N/A".
// We need the bare digit for the /learn/articles/?trimester=N filter.
function trimesterNumber(raw: string | undefined): '1' | '2' | '3' | null {
  if (!raw) return null
  const ch = raw.trim().charAt(0)
  if (ch === '1' || ch === '2' || ch === '3') return ch
  return null
}

export default function LearnPage() {
  const { t, i18n } = useTranslation()
  const isSwahili = i18n.language === 'sw'

  const [tab, setTab] = useState<'browse' | 'saved'>('browse')
  const [trimesterFilter, setTrimesterFilter] = useState<'auto' | '1' | '2' | '3' | 'all'>('auto')
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Articles split into the two buckets we render under separate headers.
  const [trimesterArticles, setTrimesterArticles] = useState<Article[]>([])
  const [generalArticles, setGeneralArticles]   = useState<Article[]>([])

  // The user's actual trimester from /patients/dashboard/ (null if unknown).
  const [userTrimester, setUserTrimester] = useState<'1' | '2' | '3' | null>(null)
  const [savedArticles, setSavedArticles] = useState<Article[]>([])

  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [err, setErr] = useState('')

  // ── Fetch the user's trimester once on mount.
  useEffect(() => {
    let cancelled = false
    api.get('/patients/dashboard/')
      .then(r => {
        if (cancelled) return
        const raw = r?.data?.pregnancy_info?.trimester as string | undefined
        setUserTrimester(trimesterNumber(raw))
      })
      .catch(e => {
        console.error('Failed to load patient dashboard', e)
        setUserTrimester(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const fetchArticles = useCallback(async () => {
    setSearchLoading(true)
    setErr('')

    // Decide which trimester filter to apply.
    // "auto" → use the user's actual trimester (split layout).
    // explicit value → manual override.
    const effective: '1' | '2' | '3' | 'all' | null =
      trimesterFilter === 'auto'
        ? userTrimester
        : trimesterFilter

    try {
      if (effective && effective !== 'all') {
        // Split fetch: trimester-specific + general "all" bucket.
        const [tRes, allRes] = await Promise.all([
          api.get<Article[]>(`/learn/articles/?trimester=${effective}`),
          api.get<Article[]>('/learn/articles/?trimester=all'),
        ])

        // The trimester-specific endpoint already includes "all" articles
        // (backend uses Q(trimester=N) | Q(trimester='all')). De-dupe by id,
        // then split client-side so we can render the two sections.
        const seen = new Set<number>()
        const tBucket: Article[] = []
        const aBucket: Article[] = []

        const consume = (a: Article) => {
          if (seen.has(a.id)) return
          seen.add(a.id)
          if (a.trimester === 'all') aBucket.push(a)
          else tBucket.push(a)
        }
        tRes.data.forEach(consume)
        allRes.data.forEach(consume)

        setTrimesterArticles(applyClientFilters(tBucket, activeCategoryLabel, searchQuery))
        setGeneralArticles(applyClientFilters(aBucket, activeCategoryLabel, searchQuery))
      } else {
        // No trimester known, or user picked "All" — fetch unfiltered list.
        const res = await api.get<Article[]>('/learn/articles/')
        setTrimesterArticles([])
        setGeneralArticles(applyClientFilters(res.data, activeCategoryLabel, searchQuery))
      }
    } catch (e) {
      console.error('Error fetching articles', e)
      setErr('Could not load tips. Please try again.')
      setTrimesterArticles([])
      setGeneralArticles([])
    } finally {
      setSearchLoading(false)
    }
  }, [trimesterFilter, userTrimester, activeCategoryLabel, searchQuery])

  const fetchSavedArticles = useCallback(async () => {
    try {
      // Bookmarks still live in the /tips/ app; their shape is identical.
      const res = await api.get<Article[]>('/tips/saved/')
      setSavedArticles(res.data)
    } catch (e) {
      console.error('Error fetching saved articles', e)
    }
  }, [])

  useEffect(() => { void fetchSavedArticles() }, [fetchSavedArticles])

  useEffect(() => {
    if (tab !== 'browse') return
    if (loading) return
    const handler = setTimeout(() => { void fetchArticles() }, 300)
    return () => clearTimeout(handler)
  }, [fetchArticles, tab, loading])

  const toggleBookmark = async (id: number) => {
    try {
      await api.post(`/tips/${id}/bookmark/`)
      void fetchSavedArticles()
      const flip = (xs: Article[]) =>
        xs.map(a => a.id === id ? { ...a, is_bookmarked: !a.is_bookmarked } : a)
      setTrimesterArticles(flip)
      setGeneralArticles(flip)
    } catch (e) {
      console.error(e)
    }
  }

  const trimesterHeader = useMemo(() => {
    if (trimesterFilter === 'auto' && userTrimester) {
      const label = userTrimester === '1' ? '1st' : userTrimester === '2' ? '2nd' : '3rd'
      return `Tips for your ${label} Trimester`
    }
    if (trimesterFilter === '1') return 'Tips for the 1st Trimester'
    if (trimesterFilter === '2') return 'Tips for the 2nd Trimester'
    if (trimesterFilter === '3') return 'Tips for the 3rd Trimester'
    return 'Tips for your Trimester'
  }, [trimesterFilter, userTrimester])

  if (loading) {
    return (
      <PageWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="p-5 pb-24">
        <h1 className="text-2xl font-bold mb-0.5">{t('learn_title')}</h1>
        <p className="text-gray-500 text-sm mb-5">{t('learn_subtitle')}</p>

        {/* Tab toggle */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
          {(['browse', 'saved'] as const).map(t_key => (
            <button key={t_key} onClick={() => setTab(t_key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab === t_key ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}>
              {t_key === 'saved' ? `${t('saved')} (${savedArticles.length})` : t('browse')}
            </button>
          ))}
        </div>

        {tab === 'browse' && (
          <>
            {/* Category grid */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {CATEGORIES.map(c => (
                <div key={c.label}
                  onClick={() => setActiveCategoryLabel(activeCategoryLabel === c.label ? null : c.label)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl cursor-pointer active:scale-95 transition-all border-2 ${activeCategoryLabel === c.label ? 'border-rose-400 shadow-sm' : 'border-transparent'}`}
                  style={{ background: c.color }}>
                  <span className="text-2xl mb-1">{c.icon}</span>
                  <span className="text-xs font-semibold text-gray-700 text-center leading-tight">
                    {t(`categories.${c.label}`)}
                  </span>
                </div>
              ))}
            </div>

            {/* Search */}
            <input
              className="input-field mb-4"
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />

            {/* Trimester filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
              {([
                { v: 'auto' as const, l: 'My Trimester' },
                { v: '1' as const,    l: '1st' },
                { v: '2' as const,    l: '2nd' },
                { v: '3' as const,    l: '3rd' },
                { v: 'all' as const,  l: 'All' },
              ]).map(({ v, l }) => (
                <button key={v} onClick={() => setTrimesterFilter(v)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${trimesterFilter === v ? 'bg-rose-400 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </>
        )}

        {err && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm">
            {err}
          </div>
        )}

        {/* Tips list */}
        {searchLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-rose-400" />
          </div>
        ) : tab === 'saved' ? (
          <ArticleList
            articles={savedArticles}
            isSwahili={isSwahili}
            onToggleBookmark={toggleBookmark}
            emptyText={t('no_tips')}
          />
        ) : (
          <>
            {trimesterArticles.length > 0 && (
              <>
                <h2 className="text-sm font-bold text-gray-700 mb-2 mt-1">
                  {trimesterHeader}
                </h2>
                <ArticleList
                  articles={trimesterArticles}
                  isSwahili={isSwahili}
                  onToggleBookmark={toggleBookmark}
                />
              </>
            )}

            {generalArticles.length > 0 && (
              <>
                <h2 className="text-sm font-bold text-gray-700 mb-2 mt-5">
                  General Tips
                </h2>
                <ArticleList
                  articles={generalArticles}
                  isSwahili={isSwahili}
                  onToggleBookmark={toggleBookmark}
                />
              </>
            )}

            {trimesterArticles.length === 0 && generalArticles.length === 0 && !err && (
              <div className="text-center py-12 text-gray-400 text-sm">
                {t('no_tips')}
              </div>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  )
}

// ─────────────────────────────────────────── Local helpers

// Apply category + free-text search filters client-side, since the
// /learn/articles/ endpoint takes only trimester.
function applyClientFilters(
  list: Article[],
  category: string | null,
  query: string,
): Article[] {
  let out = list
  if (category) {
    out = out.filter(a =>
      a.title.toLowerCase().includes(category.replace(/_/g, ' '))
      || (a.tip_type || '').toLowerCase().includes(category.replace(/_/g, ' ')),
    )
  }
  if (query) {
    const q = query.toLowerCase()
    out = out.filter(a =>
      a.title.toLowerCase().includes(q)
      || a.description.toLowerCase().includes(q)
      || (a.title_sw || '').toLowerCase().includes(q)
      || (a.description_sw || '').toLowerCase().includes(q),
    )
  }
  return out
}

function ArticleList({ articles, isSwahili, onToggleBookmark, emptyText }: {
  articles: Article[]
  isSwahili: boolean
  onToggleBookmark: (id: number) => void
  emptyText?: string
}) {
  if (articles.length === 0 && emptyText) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        {emptyText}
      </div>
    )
  }
  return (
    <>
      {articles.map(a => (
        <div key={a.id}
             className="flex items-start justify-between bg-white rounded-xl p-4 mb-2.5 shadow-sm border border-gray-100">
          <div className="flex-1 pr-3">
            <p className="font-bold text-sm">
              {isSwahili ? (a.title_sw || a.title) : a.title}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isSwahili ? (a.description_sw || a.description) : a.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <button className="w-9 h-9 rounded-full bg-lavender-100 flex items-center justify-center">
              <Volume2 size={14} className="text-purple-400" />
            </button>
            <button onClick={() => onToggleBookmark(a.id)}
                    className="w-9 h-9 rounded-full bg-lavender-100 flex items-center justify-center">
              <Bookmark size={14}
                        className={a.is_bookmarked ? 'text-rose-500 fill-rose-500' : 'text-purple-400'} />
            </button>
          </div>
        </div>
      ))}
    </>
  )
}
