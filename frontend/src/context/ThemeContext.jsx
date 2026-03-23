import { createContext, useContext, useEffect, useState } from 'react'

const ACCENT_COLORS = {
  purple: { primary: '#7c3aed', hover: '#6d28d9', light: '#8b5cf6' },
  blue:   { primary: '#2563eb', hover: '#1d4ed8', light: '#3b82f6' },
  green:  { primary: '#059669', hover: '#047857', light: '#10b981' },
  orange: { primary: '#ea580c', hover: '#c2410c', light: '#f97316' },
  pink:   { primary: '#db2777', hover: '#be185d', light: '#ec4899' },
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme,  setTheme]  = useState(() => localStorage.getItem('pyxis_theme')  || 'dark')
  const [accent, setAccent] = useState(() => localStorage.getItem('pyxis_accent') || 'purple')

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    localStorage.setItem('pyxis_theme', theme)

    const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.purple
    root.style.setProperty('--color-primary',       colors.primary)
    root.style.setProperty('--color-primary-hover', colors.hover)
    root.style.setProperty('--color-primary-light', colors.light)
    localStorage.setItem('pyxis_accent', accent)
  }, [theme, accent])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent, ACCENT_COLORS }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
