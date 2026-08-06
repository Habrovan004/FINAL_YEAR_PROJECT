import { createContext, useContext, useEffect, useState } from 'react'

export type TextSize = 'small' | 'medium' | 'large'

const SCALE: Record<TextSize, number> = { small: 0.9, medium: 1, large: 1.15 }
const ORDER: TextSize[] = ['small', 'medium', 'large']
const STORAGE_KEY = 'mama-text-size'

interface TextSizeContextType {
  textSize: TextSize
  setTextSize: (size: TextSize) => void
  cycleTextSize: () => void
}

const TextSizeContext = createContext<TextSizeContextType>({
  textSize: 'medium',
  setTextSize: () => {},
  cycleTextSize: () => {},
})

function readStored(): TextSize {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'small' || saved === 'medium' || saved === 'large' ? saved : 'medium'
  } catch {
    return 'medium'
  }
}

function writeStored(size: TextSize) {
  try {
    localStorage.setItem(STORAGE_KEY, size)
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>(readStored)

  useEffect(() => {
    // Scales every rem-based font-size app-wide (Tailwind's text-* utilities
    // are rem-based) from a single place, the same way ThemeContext flips
    // [data-theme] on <html> for the whole app.
    document.documentElement.style.fontSize = `${SCALE[textSize] * 100}%`
    document.documentElement.setAttribute('data-text-size', textSize)
    writeStored(textSize)
  }, [textSize])

  const setTextSize = (size: TextSize) => setTextSizeState(size)
  const cycleTextSize = () => setTextSizeState(prev => ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length])

  return (
    <TextSizeContext.Provider value={{ textSize, setTextSize, cycleTextSize }}>
      {children}
    </TextSizeContext.Provider>
  )
}

export const useTextSize = () => useContext(TextSizeContext)
