"use client"

import { SignUpButton as ClerkSignUpButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export function SignUpButton() {
  return (
    <ClerkSignUpButton mode="modal">
      <Button>
        Get Started
      </Button>
    </ClerkSignUpButton>
  )
} 
