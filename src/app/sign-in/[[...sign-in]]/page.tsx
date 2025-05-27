import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Welcome back to Keyvex</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to continue building amazing interactive tools
          </p>
        </div>
        <SignIn />
      </div>
    </div>
  )
} 