import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Moon } from 'lucide-react'
import api from '../../api/client'
import { useTextSize } from '../../context/TextSizeContext'

interface UserPreferences {
    language: 'en' | 'sw'
    font_size: 'small' | 'medium' | 'large'
    notifications_enabled: boolean
    audio_guidance: boolean
}

const DARK_BG      = '#1a0d12'
const ACCENT_PINK  = '#e05c7a'
const SUBTLE_BG    = 'rgba(255,255,255,0.05)'
const SUBTLE_BORDER = 'rgba(255,255,255,0.1)'

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button
            onClick={onToggle}
            role="switch"
            aria-checked={on}
            style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                backgroundColor: on ? ACCENT_PINK : 'rgba(255,255,255,0.18)',
                position: 'relative', flexShrink: 0, transition: 'background 0.2s ease',
            }}
        >
            <span style={{
                position: 'absolute', top: 3, width: 18, height: 18,
                borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                transition: 'left 0.2s ease', left: on ? 23 : 3,
            }} />
        </button>
    )
}

export default function PreferencesPage() {
    const nav = useNavigate()
    const { setTextSize } = useTextSize()

    const [preferences, setPreferences] = useState<UserPreferences>({
        language: 'sw',
        font_size: 'medium',
        notifications_enabled: true,
        audio_guidance: false,
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving]   = useState(false)
    const [error, setError]     = useState('')

    // ── Load existing preferences ─────────────────────────────────────────────
    useEffect(() => {
        let mounted = true
        ;(async () => {
            try {
                const response = await api.get('/patients/profile/')
                if (!mounted) return
                const fontSize = response.data.font_size || 'medium'
                setPreferences(prev => ({
                    ...prev,
                    language:               response.data.language               || 'sw',
                    font_size:              fontSize,
                    notifications_enabled:  response.data.notifications_enabled !== false,
                    audio_guidance:         response.data.audio_guidance === true,
                }))
                setTextSize(fontSize)
            } catch (e) {
                console.error('Error fetching preferences:', e)
            } finally {
                if (mounted) setLoading(false)
            }
        })()
        return () => { mounted = false }
    }, [])

    // ── Save single preference on change ─────────────────────────────────────
    const updatePreference = async (key: keyof UserPreferences, value: string | boolean) => {
        const updated = { ...preferences, [key]: value }
        setPreferences(updated)
        if (key === 'font_size') setTextSize(value as UserPreferences['font_size'])
        setSaving(true)
        setError('')
        try {
            await api.patch('/patients/profile/', { [key]: value })
        } catch (e) {
            console.error('Error saving preference:', e)
            setError('Hiswi ya kuokoa mapendeleo yako')
            setPreferences(preferences)
        } finally {
            setSaving(false)
        }
    }

    // ── Save all and navigate ─────────────────────────────────────────────────
    const handleContinue = async () => {
        setSaving(true)
        setError('')
        try {
            await api.patch('/patients/profile/', preferences)
            nav('/home')
        } catch (e) {
            console.error('Error saving preferences:', e)
            setError('Hiswi ya kumalizia mapendeleo')
        } finally {
            setSaving(false)
        }
    }

    // ── Loading screen ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: DARK_BG }}>
                <Loader2 size={32} style={{ color: ACCENT_PINK, animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100dvh', backgroundColor: DARK_BG, fontFamily: "'DM Sans', sans-serif", WebkitFontSmoothing: 'antialiased' }}>
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px 40px' }}>

                {/* ── Header ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0 0' }}>
                    <button
                        onClick={() => nav(-1)}
                        style={{ width: 32, height: 32, borderRadius: '50%', background: SUBTLE_BG, border: `0.5px solid ${SUBTLE_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                        <ArrowLeft size={16} color="rgba(255,255,255,0.7)" />
                    </button>

                    {/* Progress bar */}
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
                        <div style={{ width: '88%', height: '100%', background: `linear-gradient(90deg, ${ACCENT_PINK}, #c94b6a)`, borderRadius: 2 }} />
                    </div>

                    <div style={{ display: 'flex', gap: 4 }}>
                        {(['en', 'sw'] as const).map(lang => (
                            <button
                                key={lang}
                                onClick={() => updatePreference('language', lang)}
                                style={{
                                    background: preferences.language === lang ? ACCENT_PINK : SUBTLE_BG,
                                    border: 'none', borderRadius: 20, padding: '4px 10px',
                                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                    color: preferences.language === lang ? '#fff' : 'rgba(255,255,255,0.45)',
                                    transition: 'background 0.2s ease',
                                }}
                            >
                                {lang.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: SUBTLE_BG, border: `0.5px solid ${SUBTLE_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Moon size={15} color="rgba(255,255,255,0.5)" />
                    </div>
                </div>

                {/* ── Step + Title ── */}
                <div style={{ padding: '20px 0 0' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: ACCENT_PINK, margin: '0 0 6px' }}>
                        Hatua 7 ya 8
                    </p>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>
                        Mapendeleo yako
                    </h1>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                        Binafsisha matumizi yako ya app.
                    </p>
                </div>

                {/* ── Error ── */}
                {error && (
                    <div style={{ margin: '14px 0 0', padding: '10px 14px', borderRadius: 10, background: 'rgba(224,92,122,0.1)', border: `0.5px solid ${ACCENT_PINK}`, fontSize: 12, color: ACCENT_PINK }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>

                    {/* ── Box 1: Notifications ── */}
                    <div style={{ background: SUBTLE_BG, border: `0.5px solid ${SUBTLE_BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px 0' }}>
                            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
                                Taarifa
                            </p>
                        </div>

                        {/* Toggle 1 */}
                        <div style={{ padding: '0 16px 14px', borderBottom: `0.5px solid ${SUBTLE_BORDER}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', margin: '0 0 2px' }}>Vidokezo vya wiki</p>
                                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Pokea ushauri wa ujauzito kila wiki</p>
                                </div>
                                <Toggle on={preferences.notifications_enabled} onToggle={() => updatePreference('notifications_enabled', !preferences.notifications_enabled)} />
                            </div>
                        </div>

                        {/* Toggle 2 */}
                        <div style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', margin: '0 0 2px' }}>Maelekezo ya Sauti</p>
                                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Jifunze kupitia sauti</p>
                                </div>
                                <Toggle on={preferences.audio_guidance} onToggle={() => updatePreference('audio_guidance', !preferences.audio_guidance)} />
                            </div>
                        </div>
                    </div>

                    {/* ── Box 2: Font Size ── */}
                    <div style={{ background: SUBTLE_BG, border: `0.5px solid ${SUBTLE_BORDER}`, borderRadius: 16, padding: '14px 16px' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
                            Ukubwa wa Maandishi
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {([
                                { key: 'small',  label: 'S', name: 'Ndogo',  size: 11 },
                                { key: 'medium', label: 'M', name: 'Kati',   size: 14 },
                                { key: 'large',  label: 'L', name: 'Kubwa',  size: 17 },
                            ] as const).map(item => {
                                const active = preferences.font_size === item.key
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => updatePreference('font_size', item.key)}
                                        style={{
                                            flex: 1, padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                            background: active ? 'rgba(224,92,122,0.15)' : 'rgba(255,255,255,0.04)',
                                            outline: active ? `1.5px solid ${ACCENT_PINK}` : '1.5px solid rgba(255,255,255,0.12)',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <p style={{ fontSize: item.size, fontWeight: 600, color: active ? ACCENT_PINK : 'rgba(255,255,255,0.45)', margin: '0 0 2px' }}>{item.label}</p>
                                        <p style={{ fontSize: 10, color: active ? ACCENT_PINK : 'rgba(255,255,255,0.3)', margin: 0 }}>{item.name}</p>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* ── Box 3: Language ── */}
                    <div style={{ background: SUBTLE_BG, border: `0.5px solid ${SUBTLE_BORDER}`, borderRadius: 16, padding: '14px 16px' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
                            Lugha
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {([
                                { code: 'en', label: 'EN', name: 'English',    flag: '🇬🇧' },
                                { code: 'sw', label: 'SW', name: 'Kiswahili',  flag: '🇹🇿' },
                            ] as const).map(lang => {
                                const active = preferences.language === lang.code
                                return (
                                    <button
                                        key={lang.code}
                                        onClick={() => updatePreference('language', lang.code)}
                                        style={{
                                            flex: 1, padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                            background: active ? 'rgba(224,92,122,0.15)' : 'rgba(255,255,255,0.04)',
                                            outline: active ? `1.5px solid ${ACCENT_PINK}` : '1.5px solid rgba(255,255,255,0.12)',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <p style={{ fontSize: 18, margin: '0 0 2px' }}>{lang.flag}</p>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: active ? ACCENT_PINK : 'rgba(255,255,255,0.45)', margin: '0 0 1px' }}>{lang.label}</p>
                                        <p style={{ fontSize: 10, color: active ? ACCENT_PINK : 'rgba(255,255,255,0.3)', margin: 0 }}>{lang.name}</p>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                </div>

                {/* ── Continue button ── */}
                <button
                    onClick={handleContinue}
                    disabled={saving}
                    style={{
                        width: '100%', marginTop: 20, padding: '15px', borderRadius: 14, border: 'none',
                        background: `linear-gradient(135deg, ${ACCENT_PINK}, #c94b6a)`,
                        color: '#fff', fontSize: 15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1, fontFamily: "'DM Sans', sans-serif",
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'opacity 0.2s ease',
                    }}
                >
                    {saving ? (
                        <>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                            Inakukamata...
                        </>
                    ) : (
                        'Endelea →'
                    )}
                </button>

                {/* Saving indicator */}
                {saving && (
                    <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>
                        Inakuokoa mapendeleo yako...
                    </p>
                )}

            </div>
        </div>
    )
}
