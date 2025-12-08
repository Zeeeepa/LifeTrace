"use client"

import { useEffect, useState } from "react"
import { Languages } from "lucide-react"
import { useLocaleStore, type Locale } from "@/lib/store/locale"
import { useTranslations } from "@/lib/i18n"

export function LanguageToggle() {
  const { locale, setLocale } = useLocaleStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-9 w-9" />
  }

  const t = useTranslations(locale)

  const languages: { value: Locale; label: string }[] = [
    { value: "zh", label: t.language.zh },
    { value: "en", label: t.language.en }
  ]

  const handleToggle = () => {
    const currentIndex = languages.findIndex((l) => l.value === locale)
    const nextIndex = (currentIndex + 1) % languages.length
    setLocale(languages[nextIndex].value)
  }

  const currentLanguage = languages.find((l) => l.value === locale)

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      title={`${t.layout.currentLanguage}: ${currentLanguage?.label}`}
      aria-label={`${t.layout.currentLanguage}: ${currentLanguage?.label}`}
    >
      <Languages className="h-5 w-5" />
    </button>
  )
}
