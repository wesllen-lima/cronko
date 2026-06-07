"use client"

import { useState, useEffect } from "react"
import { useT } from "@/lib/i18n"

function decodeEmail(): string | null {
  try {
    const Cookies = require("js-cookie")
    const token = Cookies.default?.get("cronko_token")
    if (!token) return null
    const payload = JSON.parse(atob(token.split(".")[1]!))
    return payload?.email ?? null
  } catch {
    return null
  }
}

function getInitials(email: string): string {
  const parts = email.split("@")[0]!.split(/[._-]/)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const colors = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
]

export function UserAvatar({
  collapsed = false,
  compact = false,
}: {
  collapsed?: boolean
  compact?: boolean
}) {
  const { t } = useT()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    setEmail(decodeEmail())
  }, [])

  const initials = email ? getInitials(email) : "?"
  const colorIndex = email
    ? email.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length
    : 0
  const color = colors[colorIndex]!

  if (compact || collapsed) {
    return (
      <div
        className={`h-7 w-7 rounded-full ${email ? color : "bg-zinc-700"} flex items-center justify-center text-[10px] font-semibold text-white shrink-0`}
        title={email ?? undefined}
      >
        {initials}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <div
        className={`h-7 w-7 rounded-full ${email ? color : "bg-zinc-700"} flex items-center justify-center text-[10px] font-semibold text-white shrink-0`}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-none text-[#697386] dark:text-zinc-400 truncate">
          {email ?? t("ui.notSignedIn")}
        </p>
      </div>
    </div>
  )
}