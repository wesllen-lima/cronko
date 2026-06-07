"use client"

import type { ReactNode } from "react"
import { ThemeProvider } from "./ThemeProvider"
import { ToastProvider } from "./Toast"
import { CommandPalette } from "./CommandPalette"
import { KeyboardShortcuts } from "./KeyboardShortcuts"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        {children}
        <CommandPalette />
        <KeyboardShortcuts />
      </ToastProvider>
    </ThemeProvider>
  )
}