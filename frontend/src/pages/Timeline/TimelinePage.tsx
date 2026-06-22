import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, TrendingUp, Calendar, Weight } from 'lucide-react'
import { XAxis, ResponsiveContainer, Tooltip, Area, AreaChart, YAxis, CartesianGrid } from 'recharts'
import api from '../../api/client'

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

const MOODS = [
  { val: 5, emoji: '😄', label: 'Great' },
  { val: 4, emoji: '😊', label: 'Good' },
  { val: 3, emoji: '😐', label: 'Okay' },
  { val: 2, emoji: '😟', label: 'Not well' },
  { val: 1, emoji: '😢', label: 'Bad' }
]

const MOOD_LABELS: Record<number, string> = { 5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Not well', 1: 'Bad' }

export default function TimelinePage() {
  const nav = useNavigate()
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Mood')

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await api.get('/tracking/timeline/')
        setData(response.data)
      } catch (error) {
        console.error('Error fetching timeline:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTimeline()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
      </div>
    )
  }

  const moodChartData = (data?.mood_logs || []).map(l => ({
    day: new Date(l.date).toLocaleDateString('en', { weekday: 'short' }),
    mood: l.mood
  }))

  const weightChartData = (data?.weight_history || []).map(w => ({
    date: new Date(w.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    weight: w.weight_kg
  }))

  return (
    <div className="min-h-screen pb-24 bg-[#faf9f7] flex justify-center">
      <div className="w-full max-w-lg p-5">
        <header className="flex items-center justify-between mb-6">
          <button onClick={() => nav('/home')} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Health Progress</h1>
          <div className="w-10" />
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Avg Mood</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-gray-800">
                {data?.summary.avg_mood ? data.summary.avg_mood.toFixed(1) : '--'}
              </span>
              <span className="text-xs text-rose-400 font-semibold mb-1">/ 5</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Last Weight</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-gray-800">
                {data?.summary.last_weight ? data.summary.last_weight : '--'}
              </span>
              <span className="text-xs text-blue-400 font-semibold mb-1">kg</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6">
          {['Mood', 'Weight', 'Symptoms'].map(t => (
            <button 
              key={t} 
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Charts Section */}
        {tab === 'Mood' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-sm text-gray-700">Mood Trends</h3>
              <span className="text-[10px] bg-rose-50 text-rose-500 px-2 py-1 rounded-full font-bold">LAST 7 DAYS</span>
            </div>
            <div className="h-48 w-full">
              {moodChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={moodChartData}>
                    <defs>
                      <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{fontSize:10, fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                    <YAxis hide domain={[1, 5]} />
                    <Tooltip 
                      contentStyle={{ borderRadius:'16px', border:'none', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: any) => [MOOD_LABELS[v], 'Status']} 
                    />
                    <Area type="monotone" dataKey="mood" stroke="#f43f5e" strokeWidth={3} fill="url(#moodGrad)" dot={{fill:'#f43f5e', r:4, strokeWidth:2, stroke:'#fff'}} activeDot={{ r: 6, strokeWidth:0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                  <Calendar size={32} strokeWidth={1.5} />
                  <p className="text-xs">No mood data recorded yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'Weight' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-sm text-gray-700">Weight Gain (kg)</h3>
              <TrendingUp size={16} className="text-blue-400" />
            </div>
            <div className="h-48 w-full">
              {weightChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightChartData}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{fontSize:10, fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                    <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip 
                      contentStyle={{ borderRadius:'16px', border:'none', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: any) => [`${v} kg`, 'Weight']} 
                    />
                    <Area type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} fill="url(#weightGrad)" dot={{fill:'#3b82f6', r:4, strokeWidth:2, stroke:'#fff'}} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                  <TrendingUp size={32} strokeWidth={1.5} />
                  <p className="text-xs">Log your weight to see progress</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Entries */}
        <h3 className="font-bold text-lg mb-4 px-1">Journal History</h3>
        <div className="space-y-3">
          {data?.mood_logs && data.mood_logs.length > 0 ? (
            data.mood_logs.map((log: Log) => (
              <div key={log.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 transition-all active:scale-[0.98]">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-bold text-rose-400 uppercase tracking-widest">
                      {new Date(log.date).toLocaleDateString('en', { weekday:'long', month:'short', day:'numeric' })}
                    </p>
                    <p className="font-bold text-gray-800 mt-1">{MOOD_LABELS[log.mood]}</p>
                  </div>
                  <span className="text-2xl">{MOODS.find(m => m.val === log.mood)?.emoji}</span>
                </div>
                
                {log.symptoms && log.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {log.symptoms.map(s => (
                      <span key={s} className="bg-gray-50 text-gray-500 text-[10px] px-2 py-1 rounded-full font-semibold border border-gray-100">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                
                {log.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-500 italic leading-relaxed">"{log.notes}"</p>
                  </div>
                )}
                
                {log.weight_kg && (
                  <div className="mt-3 flex items-center gap-1.5 text-blue-500">
                    <Weight size={12} />
                    <span className="text-[10px] font-bold">{log.weight_kg} kg recorded</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">Your journal entries will appear here.</p>
              <button 
                onClick={() => nav('/track')}
                className="mt-4 text-rose-400 font-bold text-sm"
              >
                Start your first entry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
