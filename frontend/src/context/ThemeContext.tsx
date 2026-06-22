import { createContext, useContext, useEffect, useState } from 'react'

interface ThemeContextType {
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  dark: false,
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState<boolean>(() => {
    // Persist preference across sessions
    return localStorage.getItem('mama-theme') === 'dark'
  })

  useEffect(() => {
    // Apply to <html> so every page picks it up via CSS [data-theme]
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('mama-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => setDark(prev => !prev)

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
