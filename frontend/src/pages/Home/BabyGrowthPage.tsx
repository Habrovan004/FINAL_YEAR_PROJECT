import { useMemo, useState } from 'react'
import { Activity, ArrowLeft, Ear, Heart, HeartPulse, Loader2, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageWrapper from '../../components/layout/PageWrapper'
import './BabyGrowthPage.css'

interface GrowthWeek {
  week: number
  trimesterKey: 'trimester.first' | 'trimester.second' | 'trimester.third'
  emoji: string
  // Localised content lives alongside English in the same row to keep this
  // page self-contained and avoid bloating the i18n.ts dictionary with 60+
  // per-week keys.
  en: { size: string; length: string; note: string; babyFacts: string[]; motherFeels: string[] }
  sw: { size: string; length: string; note: string; babyFacts: string[]; motherFeels: string[] }
}

const WEEK_DATA: GrowthWeek[] = [
  {
    week: 4, trimesterKey: 'trimester.first', emoji: '🌱',
    en: {
      size: 'poppy seed', length: 'About 0.2 cm',
      note: 'The neural tube and early placenta are forming.',
      babyFacts: ['Early brain and spine cells are developing', 'The placenta starts supporting growth'],
      motherFeels: ['Missed period', 'Tender breasts', 'Tiredness may begin'],
    },
    sw: {
      size: 'mbegu ya popi', length: 'Takriban sm 0.2',
      note: 'Mrija wa neva na placenta ya awali zinaundwa.',
      babyFacts: ['Seli za awali za ubongo na mgongo zinakua', 'Placenta inaanza kusaidia ukuaji'],
      motherFeels: ['Hedhi kukosa', 'Maumivu ya matiti', 'Uchovu unaweza kuanza'],
    },
  },
  {
    week: 8, trimesterKey: 'trimester.first', emoji: '🫐',
    en: {
      size: 'blueberry', length: 'About 1.6 cm',
      note: 'Tiny arms, legs, and facial features are taking shape.',
      babyFacts: ['Heartbeat is usually present', 'Fingers and toes are beginning'],
      motherFeels: ['Nausea can be stronger', 'Frequent urination', 'Food smells may bother you'],
    },
    sw: {
      size: 'blueberry', length: 'Takriban sm 1.6',
      note: 'Mikono midogo, miguu, na sura za uso zinaanza kuunda.',
      babyFacts: ['Mapigo ya moyo huwa yanasikika', 'Vidole vya mikono na miguu vinaanza'],
      motherFeels: ['Kichefuchefu kinaweza kuwa kikali', 'Kukojoa mara kwa mara', 'Harufu ya chakula inaweza kusumbua'],
    },
  },
  {
    week: 12, trimesterKey: 'trimester.first', emoji: '🍋',
    en: {
      size: 'lime', length: 'About 5.4 cm',
      note: 'Most major organs have formed and will keep maturing.',
      babyFacts: ['Baby can make small movements', 'Reflexes are starting'],
      motherFeels: ['Energy may slowly return', 'Waistbands may feel tight', 'Nausea may ease soon'],
    },
    sw: {
      size: 'limau', length: 'Takriban sm 5.4',
      note: 'Viungo vingi vikubwa vimeundwa na vitaendelea kukomaa.',
      babyFacts: ['Mtoto anaweza kufanya mwendo mdogo', 'Mienendo ya akili inaanza'],
      motherFeels: ['Nguvu inaweza kurejea polepole', 'Mikanda ya kiuno inaweza kubana', 'Kichefuchefu kinaweza kupungua'],
    },
  },
  {
    week: 17, trimesterKey: 'trimester.second', emoji: '🍌',
    en: {
      size: 'banana', length: 'About 16.4 cm',
      note: 'Baby can hear sounds outside the womb.',
      babyFacts: ['Hearing is developing', 'Tiny fingerprints are forming', 'Baby is practicing swallowing'],
      motherFeels: ['Kicks becoming more regular', 'Back pain may start', 'You may notice round ligament pain'],
    },
    sw: {
      size: 'ndizi', length: 'Takriban sm 16.4',
      note: 'Mtoto anaweza kusikia sauti za nje ya tumbo.',
      babyFacts: ['Usikivu unakua', 'Alama za vidole zinaundwa', 'Mtoto anajifunza kumeza'],
      motherFeels: ['Mapigo yanazidi kuwa ya kawaida', 'Maumivu ya mgongo yanaweza kuanza', 'Unaweza kuhisi maumivu ya mishipa'],
    },
  },
  {
    week: 20, trimesterKey: 'trimester.second', emoji: '🥭',
    en: {
      size: 'mango', length: 'About 25.6 cm',
      note: 'Movements may become easier to recognize this week.',
      babyFacts: ['Sleep and wake cycles are developing', 'Skin is protected by vernix'],
      motherFeels: ['Stronger flutters or kicks', 'Leg cramps may start', 'Appetite may increase'],
    },
    sw: {
      size: 'embe', length: 'Takriban sm 25.6',
      note: 'Mwendo unaweza kuwa rahisi kutambua wiki hii.',
      babyFacts: ['Mizunguko ya usingizi na uamsho inakua', 'Ngozi inalindwa na vernix'],
      motherFeels: ['Mapigo au mwendo wa nguvu zaidi', 'Mikazo ya miguu inaweza kuanza', 'Hamu ya kula inaweza kuongezeka'],
    },
  },
  {
    week: 24, trimesterKey: 'trimester.second', emoji: '🌽',
    en: {
      size: 'ear of corn', length: 'About 30 cm',
      note: 'Lungs are developing important air sacs.',
      babyFacts: ['Baby responds to sound', 'Taste buds are active'],
      motherFeels: ['Belly growth feels faster', 'Mild swelling can happen', 'Back strain may increase'],
    },
    sw: {
      size: 'sikio la mahindi', length: 'Takriban sm 30',
      note: 'Mapafu yanakua na mifuko muhimu ya hewa.',
      babyFacts: ['Mtoto anaitikia sauti', 'Vionjo vya ladha vinatumika'],
      motherFeels: ['Tumbo linaonekana kukua haraka', 'Uvimbe mdogo unaweza kutokea', 'Mkazo wa mgongo unaweza kuongezeka'],
    },
  },
  {
    week: 28, trimesterKey: 'trimester.third', emoji: '🍆',
    en: {
      size: 'eggplant', length: 'About 37.6 cm',
      note: 'Baby can blink and is building more body fat.',
      babyFacts: ['Eyes open and close', 'Brain growth is rapid'],
      motherFeels: ['Shortness of breath may appear', 'Sleep may be harder', 'Braxton Hicks may start'],
    },
    sw: {
      size: 'biringanya', length: 'Takriban sm 37.6',
      note: 'Mtoto anaweza kufumba macho na anajenga mafuta zaidi mwilini.',
      babyFacts: ['Macho yanafunguka na kufungwa', 'Ukuaji wa ubongo ni wa haraka'],
      motherFeels: ['Kuhema kunaweza kuonekana', 'Kulala kunaweza kuwa kugumu', 'Mikazo ya Braxton Hicks inaweza kuanza'],
    },
  },
  {
    week: 32, trimesterKey: 'trimester.third', emoji: '🥥',
    en: {
      size: 'coconut', length: 'About 42.4 cm',
      note: 'Baby is gaining weight and practicing breathing movements.',
      babyFacts: ['Bones are hardening', 'Movements may feel stronger but less roomy'],
      motherFeels: ['Pelvic pressure', 'Heartburn may increase', 'More frequent urination'],
    },
    sw: {
      size: 'nazi', length: 'Takriban sm 42.4',
      note: 'Mtoto anaongeza uzito na kujifunza mwendo wa kupumua.',
      babyFacts: ['Mifupa inakuwa ngumu', 'Mwendo unaweza kuhisi wa nguvu lakini nafasi ni ndogo'],
      motherFeels: ['Shinikizo la nyonga', 'Kiungulia kinaweza kuongezeka', 'Kukojoa zaidi'],
    },
  },
  {
    week: 36, trimesterKey: 'trimester.third', emoji: '🍈',
    en: {
      size: 'melon', length: 'About 47.4 cm',
      note: 'Baby is getting ready for birth.',
      babyFacts: ['Baby may move head-down', 'Lungs are nearly mature'],
      motherFeels: ['Pressure lower in the belly', 'Walking may feel slower', 'Practice contractions'],
    },
    sw: {
      size: 'tikiti', length: 'Takriban sm 47.4',
      note: 'Mtoto anajiandaa kwa kuzaliwa.',
      babyFacts: ['Mtoto anaweza kugeuka kichwa chini', 'Mapafu yanakaribia kukomaa'],
      motherFeels: ['Shinikizo chini ya tumbo', 'Kutembea kunaweza kuhisi polepole', 'Mikazo ya mazoezi'],
    },
  },
  {
    week: 40, trimesterKey: 'trimester.third', emoji: '🎉',
    en: {
      size: 'small pumpkin', length: 'About 51.2 cm',
      note: 'Baby is full term and ready to meet you.',
      babyFacts: ['Organs are ready for life outside', 'Baby continues gaining a little weight'],
      motherFeels: ['More pelvic pressure', 'Stronger contractions may begin', 'Call care when labor signs start'],
    },
    sw: {
      size: 'malenge dogo', length: 'Takriban sm 51.2',
      note: 'Mtoto amekamilika na yuko tayari kukutana nawe.',
      babyFacts: ['Viungo viko tayari kwa maisha ya nje', 'Mtoto anaendelea kuongeza uzito kidogo'],
      motherFeels: ['Shinikizo zaidi la nyonga', 'Mikazo ya nguvu inaweza kuanza', 'Pigia huduma ukianza kuona dalili za leba'],
    },
  },
]

function getClosestWeek(week: number) {
  return WEEK_DATA.reduce((closest, item) => {
    return Math.abs(item.week - week) < Math.abs(closest.week - week) ? item : closest
  }, WEEK_DATA[0])
}

export default function BabyGrowthPage() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const isSwahili = i18n.language?.startsWith('sw')
  const [selectedWeek, setSelectedWeek] = useState(17)

  const weekData = useMemo(() => getClosestWeek(selectedWeek), [selectedWeek])
  const displayWeek = selectedWeek
  const isExactWeek = weekData.week === selectedWeek
  const localized = isSwahili ? weekData.sw : weekData.en
  const trimester = t(weekData.trimesterKey)

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
          <p className="growth-length">{localized.length}</p>
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

        {/* Animation slot intentionally hidden until video assets ship —
            previously a dead Play button. */}

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
