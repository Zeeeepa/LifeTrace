"use client"

import { User } from "lucide-react"

export function UserAvatar() {
  return (
    <button
      type="button"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      title="用户设置"
      aria-label="用户设置"
    >
      <User className="h-5 w-5" />
    </button>
  )
}
