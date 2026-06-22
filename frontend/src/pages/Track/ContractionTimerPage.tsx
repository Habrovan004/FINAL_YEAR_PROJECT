import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clock, Lightbulb, Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageWrapper from '../../components/layout/PageWrapper'
import './ContractionTimerPage.css'

interface ContractionRecord {
  id: number
  startedAt: number
  durationSeconds: number
  intervalSeconds: number | null
}

function formatSeconds(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ContractionTimerPage() {
  const nav = useNavigate()
  const [activeStart, setActiveStart] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [records, setRecords] = useState<ContractionRecord[]>([])

  useEffect(() => {
    if (!activeStart) return

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => window.clearInterval(timer)
  }, [activeStart])

  const elapsedSeconds = activeStart ? Math.max(1, Math.floor((now - activeStart) / 1000)) : 0

  const latestInterval = useMemo(() => {
    if (activeStart && records[0]) {
      return Math.max(0, Math.round((activeStart - records[0].startedAt) / 1000))
    }

    return records[0]?.intervalSeconds ?? null
  }, [activeStart, records])

  const toggleTimer = () => {
    if (!activeStart) {
      setActiveStart(Date.now())
      setNow(Date.now())
      return
    }

    const endedAt = Date.now()
    const previousStart = records[0]?.startedAt ?? null
    const durationSeconds = Math.max(1, Math.round((endedAt - activeStart) / 1000))
    const intervalSeconds = previousStart ? Math.max(0, Math.round((activeStart - previousStart) / 1000)) : null

    setRecords(previous => [
      {
        id: endedAt,
        startedAt: activeStart,
        durationSeconds,
        intervalSeconds,
      },
      ...previous,
    ])
    setActiveStart(null)
  }

  return (
    <PageWrapper>
      <div className="contraction-page">
        <header className="contraction-header">
          <button className="contraction-back" onClick={() => nav('/track')} aria-label="Go back">
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1>Contraction Timer</h1>
            <p>Track your labour contractions.</p>
          </div>
        </header>

        {(activeStart || records.length > 0) && (
          <section className="contraction-stats">
            <div className="contraction-stat">
              <p>Duration</p>
              <strong>{activeStart ? formatSeconds(elapsedSeconds) : formatSeconds(records[0].durationSeconds)}</strong>
            </div>
            <div className="contraction-stat">
              <p>Every</p>
              <strong>{latestInterval === null ? '--' : formatSeconds(latestInterval)}</strong>
            </div>
          </section>
        )}

        <section className="contraction-action">
          <button
            className={`contraction-timer-btn ${activeStart ? 'active' : ''}`}
            onClick={toggleTimer}
            aria-label={activeStart ? 'Stop contraction timer' : 'Start contraction timer'}
          >
            {activeStart ? (
              <>
                <Timer size={42} />
                <span>{formatSeconds(elapsedSeconds)}</span>
              </>
            ) : (
              <>
                <span className="contraction-emoji" role="img" aria-label="Pregnant person">🤰</span>
                <span>Tap to start</span>
              </>
            )}
          </button>
          <p>{activeStart ? 'Tap to stop' : 'Tap when one starts'}</p>
        </section>

        <section className="contraction-rule">
          <div className="contraction-rule-icon">
            <Lightbulb size={18} />
          </div>
          <div>
            <h2>Remember the 5-1-1 rule</h2>
            <p>Go to the hospital when contractions come every 5 minutes, last 1 minute, for 1 hour.</p>
          </div>
        </section>

        {records.length === 0 && !activeStart ? (
          <p className="contraction-empty">No contractions recorded. Tap the button when one starts.</p>
        ) : (
          <section className="contraction-table-card">
            <div className="contraction-table-title">
              <Clock size={16} />
              <h2>Contractions</h2>
            </div>
            <div className="contraction-table">
              <div className="contraction-row contraction-head">
                <span>Time</span>
                <span>Duration</span>
                <span>Every</span>
              </div>
              {activeStart && (
                <div className="contraction-row live">
                  <span>{formatTime(activeStart)}</span>
                  <span>{formatSeconds(elapsedSeconds)}</span>
                  <span>{latestInterval === null ? '--' : formatSeconds(latestInterval)}</span>
                </div>
              )}
              {records.map(record => (
                <div className="contraction-row" key={record.id}>
                  <span>{formatTime(record.startedAt)}</span>
                  <span>{formatSeconds(record.durationSeconds)}</span>
                  <span>{record.intervalSeconds === null ? '--' : formatSeconds(record.intervalSeconds)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageWrapper>
  )
}
