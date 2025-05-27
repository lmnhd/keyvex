import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Join Keyvex</h1>
          <p className="text-muted-foreground mt-2">
            Create your account and start building interactive tools with AI
          </p>
        </div>
        <SignUp />
      </div>
    </div>
  )
} 