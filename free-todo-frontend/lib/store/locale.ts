import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type Locale = "zh" | "en"

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const localeStorage = {
  getItem: () => {
    if (typeof window === "undefined") return null

    const language = localStorage.getItem("language")
    const locale = (language as Locale) || "zh"
    return JSON.stringify({ state: { locale } })
  },
  setItem: (_name: string, value: string) => {
    if (typeof window === "undefined") return

    try {
      const data = JSON.parse(value)
      const locale = data.state?.locale || data.locale || "zh"
      localStorage.setItem("language", locale)
    } catch (e) {
      console.error("Error saving locale:", e)
    }
  },
  removeItem: () => {
    if (typeof window === "undefined") return
    localStorage.removeItem("language")
  }
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "zh",
      setLocale: (locale) => set({ locale })
    }),
    {
      name: "locale",
      storage: createJSONStorage(() => localeStorage)
    }
  )
)
