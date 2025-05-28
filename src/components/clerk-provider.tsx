"use client"

import { ClerkProvider } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

// Convert oklch to hex colors for Clerk
const lightThemeColors = {
  primary: '#343434', // oklch(0.205 0 0) -> dark gray
  background: '#ffffff', // oklch(1 0 0) -> white
  foreground: '#252525', // oklch(0.145 0 0) -> very dark gray
  muted: '#f7f7f7', // oklch(0.97 0 0) -> light gray
  mutedForeground: '#8e8e8e', // oklch(0.556 0 0) -> medium gray
  border: '#ebebeb', // oklch(0.922 0 0) -> light border
}

const darkThemeColors = {
  primary: '#ebebeb', // oklch(0.922 0 0) -> light gray
  background: '#252525', // oklch(0.145 0 0) -> very dark gray
  foreground: '#fafafa', // oklch(0.985 0 0) -> almost white
  muted: '#444444', // oklch(0.269 0 0) -> dark gray
  mutedForeground: '#b5b5b5', // oklch(0.708 0 0) -> light gray
  border: 'rgba(255, 255, 255, 0.1)', // oklch(1 0 0 / 10%) -> transparent white
}

export function ClerkProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Use light theme as fallback during SSR
  const isDark = mounted ? resolvedTheme === 'dark' : false
  const colors = isDark ? darkThemeColors : lightThemeColors

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: colors.primary,
          colorBackground: colors.background,
          colorText: colors.foreground,
          colorInputBackground: colors.background,
          colorInputText: colors.foreground,
          colorNeutral: colors.muted,
          colorTextSecondary: colors.mutedForeground,
        },
        elements: {
          formButtonPrimary: {
            backgroundColor: colors.primary,
            color: isDark ? colors.background : colors.background,
            '&:hover': {
              backgroundColor: isDark ? '#d4d4d4' : '#2a2a2a',
            },
          },
          card: {
            backgroundColor: colors.background,
            color: colors.foreground,
            border: `1px solid ${colors.border}`,
          },
          headerTitle: {
            color: colors.foreground,
          },
          headerSubtitle: {
            color: colors.mutedForeground,
          },
          formFieldInput: {
            backgroundColor: colors.background,
            color: colors.foreground,
            border: `1px solid ${colors.border}`,
          },
          footerActionLink: {
            color: colors.primary,
            '&:hover': {
              color: isDark ? '#d4d4d4' : '#2a2a2a',
            },
          },
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
} 