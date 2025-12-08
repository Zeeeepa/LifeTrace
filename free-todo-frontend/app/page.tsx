"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"

import { BottomDock } from "@/components/layout/BottomDock"
import { PanelContainer } from "@/components/layout/PanelContainer"
import { LanguageToggle } from "@/components/common/LanguageToggle"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { UserAvatar } from "@/components/common/UserAvatar"
import { useLocaleStore } from "@/lib/store/locale"
import { useTranslations } from "@/lib/i18n"
import { useUiStore } from "@/lib/store/ui-store"

export default function HomePage() {
  const { isCalendarOpen, isBoardOpen, calendarWidth, setCalendarWidth } = useUiStore()
  const [isDragging, setIsDragging] = useState(false)
  const { locale } = useLocaleStore()
  const t = useTranslations(locale)

  const containerRef = useRef<HTMLDivElement | null>(null)

  const layoutState = useMemo(() => {
    if (isCalendarOpen && isBoardOpen) {
      return {
        showCalendar: true,
        showBoard: true,
        calendarWidth,
        boardWidth: 1 - calendarWidth,
        showResizeHandle: true
      }
    }

    if (isCalendarOpen && !isBoardOpen) {
      return {
        showCalendar: true,
        showBoard: false,
        calendarWidth: 1,
        boardWidth: 0,
        showResizeHandle: false
      }
    }

    if (!isCalendarOpen && isBoardOpen) {
      return {
        showCalendar: false,
        showBoard: true,
        calendarWidth: 0,
        boardWidth: 1,
        showResizeHandle: false
      }
    }

    return {
      showCalendar: true,
      showBoard: false,
      calendarWidth: 1,
      boardWidth: 0,
      showResizeHandle: false
    }
  }, [isCalendarOpen, isBoardOpen, calendarWidth])

  const handleDragAtClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      if (rect.width <= 0) return

      const relativeX = clientX - rect.left
      const ratio = relativeX / rect.width
      setCalendarWidth(ratio)
    },
    [setCalendarWidth]
  )

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    setIsDragging(true)
    handleDragAtClientX(event.clientX)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      handleDragAtClientX(moveEvent.clientX)
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-transparent">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_60%),_radial-gradient(circle_at_bottom,_rgba(52,211,153,0.12),_transparent_55%)]" />

      <div className="relative z-10 flex flex-1 flex-col px-4 pb-20 pt-6 md:px-6 lg:px-10">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-50 md:text-xl">
              {t.page.title}
            </h1>
            <p className="mt-1 text-xs text-slate-400 md:text-sm">{t.page.subtitle}</p>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
            <UserAvatar />
          </div>
        </header>

        <div
          ref={containerRef}
          className="flex min-h-0 flex-1 gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 shadow-inner shadow-slate-900/80 backdrop-blur"
        >
          <PanelContainer
            variant="calendar"
            isVisible={layoutState.showCalendar}
            width={layoutState.calendarWidth}
          >
            <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-slate-100 md:text-base">
                  {t.page.calendarLabel}
                </h2>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  {t.page.calendarPlaceholder}
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-slate-900/60 text-xs text-slate-500 md:text-sm">
                {t.page.calendarPlaceholder}
              </div>
            </div>
          </PanelContainer>

          {layoutState.showResizeHandle ? (
            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={handleResizePointerDown}
              className={`flex items-stretch justify-center transition-all duration-200 ${
                isDragging
                  ? "w-2 cursor-col-resize px-1"
                  : "w-1 cursor-col-resize px-0.5"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  isDragging
                    ? "w-1 bg-sky-400/90 shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                    : "w-px bg-slate-700/80"
                }`}
              />
            </div>
          ) : null}

          <PanelContainer
            variant="board"
            isVisible={layoutState.showBoard}
            width={layoutState.boardWidth}
          >
            <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-slate-100 md:text-base">
                  {t.page.boardLabel}
                </h2>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  {t.page.boardPlaceholder}
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-slate-900/60 text-xs text-slate-500 md:text-sm">
                {t.page.boardPlaceholder}
              </div>
            </div>
          </PanelContainer>
        </div>
      </div>

      <BottomDock />
    </main>
  )
}
