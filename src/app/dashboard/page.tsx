import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">
              Welcome to your Dashboard, {user.firstName || user.emailAddresses[0]?.emailAddress}!
            </h1>
            <p className="text-muted-foreground mt-2">
              Start building amazing interactive tools with AI assistance.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 border border-border rounded-lg bg-card text-card-foreground">
              <h3 className="text-xl font-semibold mb-3">Create New Tool</h3>
              <p className="text-muted-foreground mb-4">
                Use AI to build calculators, quizzes, and assessments.
              </p>
              <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-colors">
                Start Building
              </button>
            </div>

            <div className="p-6 border border-border rounded-lg bg-card text-card-foreground">
              <h3 className="text-xl font-semibold mb-3">My Tools</h3>
              <p className="text-muted-foreground mb-4">
                View and manage your created tools.
              </p>
              <button className="border border-border hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-lg font-medium transition-colors">
                View Tools
              </button>
            </div>

            <div className="p-6 border border-border rounded-lg bg-card text-card-foreground">
              <h3 className="text-xl font-semibold mb-3">Analytics</h3>
              <p className="text-muted-foreground mb-4">
                Track performance and leads from your tools.
              </p>
              <button className="border border-border hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-lg font-medium transition-colors">
                View Analytics
              </button>
            </div>
          </div>

          <div className="mt-12 p-6 border border-border rounded-lg bg-card text-card-foreground">
            <h2 className="text-2xl font-bold mb-4">User Information</h2>
            <div className="space-y-2 text-sm">
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.emailAddresses[0]?.emailAddress}</p>
              <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
              <p><strong>Created:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 