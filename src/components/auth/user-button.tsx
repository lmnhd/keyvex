"use client"

import { UserButton as ClerkUserButton } from '@clerk/nextjs'

export function UserButton() {
  return (
    <ClerkUserButton 
      appearance={{
        elements: {
          avatarBox: "w-8 h-8",
        },
      }}
      showName={false}
    />
  )
} 
