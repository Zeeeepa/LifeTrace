"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { BottomDock } from "@/components/layout/BottomDock"
import { PanelContainer } from "@/components/layout/PanelContainer"
import { LanguageToggle } from "@/components/common/LanguageToggle"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { UserAvatar } from "@/components/common/UserAvatar"
import { useLocaleStore } from "@/lib/store/locale"
import { useTranslations } from "@/lib/i18n"
import { useUiStore } from "@/lib/store/ui-store"

export default function HomePage() {
  const { isCalendarOpen, isTodosOpen, calendarWidth, setCalendarWidth } = useUiStore()
  const [isDragging, setIsDragging] = useState(false)
  const { locale } = useLocaleStore()
  const t = useTranslations(locale)

  const containerRef = useRef<HTMLDivElement | null>(null)

  const layoutState = useMemo(() => {
    if (isCalendarOpen && isTodosOpen) {
      return {
        showCalendar: true,
        showTodos: true,
        calendarWidth,
        todosWidth: 1 - calendarWidth,
        showResizeHandle: true
      }
    }

    if (isCalendarOpen && !isTodosOpen) {
      return {
        showCalendar: true,
        showTodos: false,
        calendarWidth: 1,
        todosWidth: 0,
        showResizeHandle: false
      }
    }

    if (!isCalendarOpen && isTodosOpen) {
      return {
        showCalendar: false,
        showTodos: true,
        calendarWidth: 0,
        todosWidth: 1,
        showResizeHandle: false
      }
    }

    return {
      showCalendar: true,
      showTodos: false,
      calendarWidth: 1,
      todosWidth: 0,
      showResizeHandle: false
    }
  }, [isCalendarOpen, isTodosOpen, calendarWidth])

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
    <main className="relative flex h-screen flex-col overflow-hidden bg-background">
      <div className="relative z-10 flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 bg-background px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-foreground">
              {t.page.title}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
            <UserAvatar />
          </div>
        </header>

        <div
          ref={containerRef}
          className="relative flex min-h-0 flex-1 gap-1.5 overflow-hidden p-3"
        >
          <AnimatePresence mode="sync" initial={false}>
            {layoutState.showCalendar && (
              <PanelContainer
                variant="calendar"
                isVisible={layoutState.showCalendar}
                width={layoutState.calendarWidth}
              >
                <div className="flex h-full flex-col">
                  <div className="flex h-10 shrink-0 items-center border-b border-border bg-muted/30 px-4">
                    <h2 className="text-sm font-medium text-foreground">
                      {t.page.calendarLabel}
                    </h2>
                  </div>
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    {t.page.calendarPlaceholder}
                  </div>
                </div>
              </PanelContainer>
            )}
          </AnimatePresence>

          <AnimatePresence mode="sync" initial={false}>
            {layoutState.showResizeHandle && (
              <motion.div
                key="resize-handle"
                role="separator"
                aria-orientation="vertical"
                onPointerDown={handleResizePointerDown}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0, scaleX: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`flex items-stretch justify-center ${
                  isDragging
                    ? "w-2 cursor-col-resize px-1"
                    : "w-1 cursor-col-resize px-0.5"
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    isDragging
                      ? "w-1 bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                      : "w-px bg-border"
                  }`}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="sync" initial={false}>
            {layoutState.showTodos && (
              <PanelContainer
                variant="todos"
                isVisible={layoutState.showTodos}
                width={layoutState.todosWidth}
              >
                <div className="flex h-full flex-col">
                  <div className="flex h-10 shrink-0 items-center border-b border-border bg-muted/30 px-4">
                    <h2 className="text-sm font-medium text-foreground">
                      {t.page.todosLabel}
                    </h2>
                  </div>
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    {t.page.todosPlaceholder}
                  </div>
                </div>
              </PanelContainer>
            )}
          </AnimatePresence>
        </div>
      </div>

      <BottomDock />
    </main>
  )
}
