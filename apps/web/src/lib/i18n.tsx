"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react"
import { t, type Locale } from "@cronko/shared/translations"

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: "pt-BR",
  setLocale: () => {},
  t: (key: string) => key,
})

export function useT() {
  return useContext(I18nContext)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt-BR")
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("cronko_locale") as Locale | null
    if (stored === "pt-BR" || stored === "en-US") {
      setLocaleState(stored)
    }
    setLoaded(true)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem("cronko_locale", next)
  }, [])

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(locale, key, params),
    [locale],
  )

  if (!loaded) return null

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translate }}>
      {children}
    </I18nContext.Provider>
  )
}