import { createContext, useContext, useEffect, useState } from 'react'

interface ThemeContextType {
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  dark: false,
  toggle: () => {},
})

function readTheme(): boolean {
  try {
    return localStorage.getItem('mama-theme') === 'dark'
  } catch {
    return false
  }
}

function writeTheme(dark: boolean) {
  try {
    localStorage.setItem('mama-theme', dark ? 'dark' : 'light')
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState<boolean>(readTheme)

  useEffect(() => {
    // Apply to <html> so every page picks it up via CSS [data-theme]
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    writeTheme(dark)
  }, [dark])

  const toggle = () => setDark(prev => !prev)

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
