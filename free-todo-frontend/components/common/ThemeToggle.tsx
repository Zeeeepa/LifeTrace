"use client"

import { useEffect, useState } from "react"
import { Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { useLocaleStore } from "@/lib/store/locale"
import { useTranslations } from "@/lib/i18n"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { locale } = useLocaleStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-9 w-9" />
  }

  const t = useTranslations(locale)

  const themes = [
    { value: "light" as const, icon: Sun, label: t.theme.light },
    { value: "dark" as const, icon: Moon, label: t.theme.dark },
    { value: "system" as const, icon: Monitor, label: t.theme.system }
  ]

  const currentTheme = theme || "system"
  const currentIndex = themes.findIndex((themeItem) => themeItem.value === currentTheme)
  const currentThemeLabel = themes.find((themeItem) => themeItem.value === currentTheme)?.label || ""

  return (
    <button
      type="button"
      onClick={() => {
        const nextIndex = (currentIndex + 1) % themes.length
        const newTheme = themes[nextIndex].value
        setTheme(newTheme)
      }}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={`${t.layout.currentTheme}: ${currentThemeLabel}`}
      aria-label={`${t.layout.currentTheme}: ${currentThemeLabel}`}
    >
      {currentTheme === "light" && <Sun className="h-5 w-5" />}
      {currentTheme === "dark" && <Moon className="h-5 w-5" />}
      {currentTheme === "system" && <Monitor className="h-5 w-5" />}
    </button>
  )
}
