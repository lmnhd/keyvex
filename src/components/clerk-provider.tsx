"use client"

import { ClerkProvider } from '@clerk/nextjs'
import { useTheme } from 'next-themes'

export function ClerkProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const { theme } = useTheme()

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: 'hsl(var(--primary))',
          colorBackground: 'hsl(var(--background))',
          colorText: 'hsl(var(--foreground))',
          colorInputBackground: 'hsl(var(--background))',
          colorInputText: 'hsl(var(--foreground))',
        },
        elements: {
          formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
          card: 'bg-card text-card-foreground border border-border',
          headerTitle: 'text-foreground',
          headerSubtitle: 'text-muted-foreground',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
} 