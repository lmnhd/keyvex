"use client"

import { useUser } from '@clerk/nextjs'
import { SignInButton } from './sign-in-button'
import { SignUpButton } from './sign-up-button'
import { UserButton } from './user-button'

export function AuthButtons() {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-9 bg-muted animate-pulse rounded" />
        <div className="w-20 h-9 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (isSignedIn) {
    return <UserButton />
  }

  return (
    <div className="flex items-center gap-2">
      <SignInButton />
      <SignUpButton />
    </div>
  )
} 
