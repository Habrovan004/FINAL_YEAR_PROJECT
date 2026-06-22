import { useMemo, useState } from 'react'
import { Activity, ArrowLeft, Ear, Heart, HeartPulse, Loader2, Play, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageWrapper from '../../components/layout/PageWrapper'
import './BabyGrowthPage.css'

interface GrowthWeek {
  week: number
  trimester: string
  emoji: string
  size: string
  length: string
  note: string
  babyFacts: string[]
  motherFeels: string[]
}

const WEEK_DATA: GrowthWeek[] = [
  {
    week: 4,
    trimester: '1st Trimester',
    emoji: '🌱',
    size: 'poppy seed',
    length: 'About 0.2 cm',
    note: 'The neural tube and early placenta are forming.',
    babyFacts: ['Early brain and spine cells are developing', 'The placenta starts supporting growth'],
    motherFeels: ['Missed period', 'Tender breasts', 'Tiredness may begin'],
  },
  {
    week: 8,
    trimester: '1st Trimester',
    emoji: '🫐',
    size: 'blueberry',
    length: 'About 1.6 cm',
    note: 'Tiny arms, legs, and facial features are taking shape.',
    babyFacts: ['Heartbeat is usually present', 'Fingers and toes are beginning'],
    motherFeels: ['Nausea can be stronger', 'Frequent urination', 'Food smells may bother you'],
  },
  {
    week: 12,
    trimester: '1st Trimester',
    emoji: '🍋',
    size: 'lime',
    length: 'About 5.4 cm',
    note: 'Most major organs have formed and will keep maturing.',
    babyFacts: ['Baby can make small movements', 'Reflexes are starting'],
    motherFeels: ['Energy may slowly return', 'Waistbands may feel tight', 'Nausea may ease soon'],
  },
  {
    week: 17,
    trimester: '2nd Trimester',
    emoji: '🍌',
    size: 'banana',
    length: 'About 16.4 cm',
    note: 'Baby can hear sounds outside the womb.',
    babyFacts: ['Hearing is developing', 'Tiny fingerprints are forming', 'Baby is practicing swallowing'],
    motherFeels: ['Kicks becoming more regular', 'Back pain may start', 'You may notice round ligament pain'],
  },
  {
    week: 20,
    trimester: '2nd Trimester',
    emoji: '🥭',
    size: 'mango',
    length: 'About 25.6 cm',
    note: 'Movements may become easier to recognize this week.',
    babyFacts: ['Sleep and wake cycles are developing', 'Skin is protected by vernix'],
    motherFeels: ['Stronger flutters or kicks', 'Leg cramps may start', 'Appetite may increase'],
  },
  {
    week: 24,
    trimester: '2nd Trimester',
    emoji: '🌽',
    size: 'ear of corn',
    length: 'About 30 cm',
    note: 'Lungs are developing important air sacs.',
    babyFacts: ['Baby responds to sound', 'Taste buds are active'],
    motherFeels: ['Belly growth feels faster', 'Mild swelling can happen', 'Back strain may increase'],
  },
  {
    week: 28,
    trimester: '3rd Trimester',
    emoji: '🍆',
    size: 'eggplant',
    length: 'About 37.6 cm',
    note: 'Baby can blink and is building more body fat.',
    babyFacts: ['Eyes open and close', 'Brain growth is rapid'],
    motherFeels: ['Shortness of breath may appear', 'Sleep may be harder', 'Braxton Hicks may start'],
  },
  {
    week: 32,
    trimester: '3rd Trimester',
    emoji: '🥥',
    size: 'coconut',
    length: 'About 42.4 cm',
    note: 'Baby is gaining weight and practicing breathing movements.',
    babyFacts: ['Bones are hardening', 'Movements may feel stronger but less roomy'],
    motherFeels: ['Pelvic pressure', 'Heartburn may increase', 'More frequent urination'],
  },
  {
    week: 36,
    trimester: '3rd Trimester',
    emoji: '🍈',
    size: 'melon',
    length: 'About 47.4 cm',
    note: 'Baby is getting ready for birth.',
    babyFacts: ['Baby may move head-down', 'Lungs are nearly mature'],
    motherFeels: ['Pressure lower in the belly', 'Walking may feel slower', 'Practice contractions'],
  },
  {
    week: 40,
    trimester: '3rd Trimester',
    emoji: '🎉',
    size: 'small pumpkin',
    length: 'About 51.2 cm',
    note: 'Baby is full term and ready to meet you.',
    babyFacts: ['Organs are ready for life outside', 'Baby continues gaining a little weight'],
    motherFeels: ['More pelvic pressure', 'Stronger contractions may begin', 'Call care when labor signs start'],
  },
]

function getClosestWeek(week: number) {
  return WEEK_DATA.reduce((closest, item) => {
    return Math.abs(item.week - week) < Math.abs(closest.week - week) ? item : closest
  }, WEEK_DATA[0])
}

export default function BabyGrowthPage() {
  const nav = useNavigate()
  const [selectedWeek, setSelectedWeek] = useState(17)

  const weekData = useMemo(() => getClosestWeek(selectedWeek), [selectedWeek])
  const displayWeek = selectedWeek
  const isExactWeek = weekData.week === selectedWeek

  const babyFacts = isExactWeek
    ? weekData.babyFacts
    : [`Preview based on Week ${weekData.week}`, weekData.note]

  return (
    <PageWrapper>
      <div className="growth-page">
        <header className="growth-header">
          <button className="growth-back" onClick={() => nav('/home')} aria-label="Go back">
            <ArrowLeft size={19} />
          </button>
          <div className="growth-heading">
            <h1>Baby growth</h1>
            <p>Week {displayWeek} · {weekData.trimester}</p>
          </div>
          <div className="growth-header-emoji" role="img" aria-label={`${weekData.size} size`}>
            {weekData.emoji}
          </div>
        </header>

        <section className="growth-hero">
          <p className="growth-eyebrow">{weekData.trimester}</p>
          <h2>Week {displayWeek}</h2>
          <div className="growth-big-emoji" role="img" aria-label={`${weekData.size} size`}>
            {weekData.emoji}
          </div>
          <p className="growth-size">Size of a {weekData.size}</p>
          <p className="growth-length">{weekData.length}</p>
        </section>

        <section className="growth-card">
          <div className="growth-slider-top">
            <p>Explore another week</p>
            <span>{displayWeek}</span>
          </div>
          <input
            className="growth-slider"
            type="range"
            min="4"
            max="40"
            value={selectedWeek}
            onChange={(event) => setSelectedWeek(Number(event.target.value))}
            aria-label="Select pregnancy week"
          />
          <div className="growth-slider-labels">
            <span>4</span>
            <span>40</span>
          </div>
        </section>

        <section className="growth-video">
          <button className="growth-play" aria-label="Play animation">
            <Play size={28} fill="currentColor" />
          </button>
        </section>
        <div className="growth-video-copy">
          <p>How your baby looks this week</p>
          <span>30-second animation · low data</span>
        </div>

        <section className="growth-card">
          <p className="growth-section-title">What's happening inside</p>
          <p className="growth-note">{weekData.note}</p>
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
          <p className="growth-section-title">What you may feel</p>
          <div className="growth-list">
            {weekData.motherFeels.map((feeling, index) => {
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
          Content is optimized for low data use.
        </div>
      </div>
    </PageWrapper>
  )
}
