import { useState, useEffect, useCallback } from 'react'
import { Volume2, Bookmark, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import PageWrapper from '../../components/layout/PageWrapper'
import api from '../../api/client'

interface Tip {
  id: number;
  title: string;
  title_sw: string;
  description: string;
  description_sw: string;
  is_bookmarked: boolean;
  category: number;
  tip_type: string;
}

const CATEGORIES = [
  {label: 'what_to_do', icon:'🍎', color:'#ffe4e6'},
  {label: 'what_to_avoid', icon:'⚠️', color:'#ffe4e6'},
  {label: 'warning_signs', icon:'💛', color:'#fef9c3'},
  {label: 'hormonal_changes', icon:'✨', color:'#ede9fe'},
  {label: 'birth_prep', icon:'🐣', color:'#fce7f3'},
  {label: 'nutrition', icon:'🥗', color:'#dcfce7'},
]

export default function LearnPage() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<'browse'|'saved'>('browse')
  const [trimester, setTrimester] = useState('all')
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tips, setTips] = useState<Tip[]>([])
  const [savedTips, setSavedTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)

  const fetchTips = useCallback(async () => {
    setSearchLoading(true)
    try {
      const params = new URLSearchParams();
      if (trimester !== 'all') params.append('trimester', trimester);
      if (activeCategoryLabel) params.append('q', activeCategoryLabel);
      if (searchQuery) params.append('q', searchQuery);

      const res = await api.get(`/tips/?${params.toString()}`)
      setTips(res.data)
    } catch (e) {
      console.error("Error fetching tips", e)
    } finally {
      setSearchLoading(false)
    }
  }, [trimester, activeCategoryLabel, searchQuery])

  const fetchSavedTips = useCallback(async () => {
    try {
      const res = await api.get('/tips/saved/')
      setSavedTips(res.data)
    } catch (e) {
      console.error("Error fetching saved tips", e)
    }
  }, [])

  useEffect(() => {
    fetchSavedTips()
    setLoading(false)
  }, [fetchSavedTips])

  useEffect(() => {
    if (tab === 'browse') {
      const handler = setTimeout(() => {
        fetchTips()
      }, 300)
      return () => clearTimeout(handler)
    }
  }, [fetchTips, tab])

  const toggleBookmark = async (id: number) => {
    try {
      await api.post(`/tips/${id}/bookmark/`)
      fetchSavedTips()
      setTips(p => p.map(t => t.id === id ? { ...t, is_bookmarked: !t.is_bookmarked } : t))
    } catch (e) {
      console.error(e)
    }
  }

  const isSwahili = i18n.language === 'sw'
  const displayTips = tab === 'saved' ? savedTips : tips

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
          {(['browse','saved'] as const).map(t_key => (
            <button key={t_key} onClick={() => setTab(t_key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab===t_key?'bg-white shadow text-gray-800':'text-gray-400'}`}>
              {t_key === 'saved' ? `${t('saved')} (${savedTips.length})` : t('browse')}
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
                  style={{background:c.color}}>
                  <span className="text-2xl mb-1">{c.icon}</span>
                  <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{t(`categories.${c.label}`)}</span>
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
              {[{v:'all',l:'All'},{v:'1',l:'1st'},{v:'2',l:'2nd'},{v:'3',l:'3rd'}].map(({v,l}) => (
                <button key={v} onClick={() => setTrimester(v)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${trimester===v?'bg-rose-400 text-white':'bg-white border border-gray-200 text-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Tips list */}
        {searchLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-rose-400" /></div>
        ) : displayTips.length > 0 ? displayTips.map(tip => (
          <div key={tip.id} className="flex items-start justify-between bg-white rounded-xl p-4 mb-2.5 shadow-sm border border-gray-100">
            <div className="flex-1 pr-3">
              <p className="font-bold text-sm">{isSwahili ? tip.title_sw : tip.title}</p>
              <p className="text-xs text-gray-500 mt-1">{isSwahili ? tip.description_sw : tip.description}</p>
            </div>
            <div className="flex flex-col gap-2 items-center">
              <button className="w-9 h-9 rounded-full bg-lavender-100 flex items-center justify-center">
                <Volume2 size={14} className="text-purple-400" />
              </button>
              <button onClick={() => toggleBookmark(tip.id)} className="w-9 h-9 rounded-full bg-lavender-100 flex items-center justify-center">
                <Bookmark size={14} className={tip.is_bookmarked ? 'text-rose-500 fill-rose-500' : 'text-purple-400'} />
              </button>
            </div>
          </div>
        )) : (
          <div className="text-center py-12 text-gray-400 text-sm">
            {t('no_tips')}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
