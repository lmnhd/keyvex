import { ModeToggle } from "@/components/mode-toggle";
import { AuthButtons } from "@/components/auth/auth-buttons";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header with theme toggle and auth */}
      <header className="flex justify-between items-center p-6 border-b border-border">
        <h1 className="text-2xl font-bold">Keyvex</h1>
        <div className="flex items-center gap-4">
          <AuthButtons />
          <ModeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Transform Your Expertise Into
              <span className="text-primary"> Interactive Tools</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create engaging calculators, quizzes, and assessments through AI co-creation. 
              Turn your knowledge into high-converting lead magnets.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-lg font-medium transition-colors">
              Start Building
            </button>
            <button className="border border-border hover:bg-accent hover:text-accent-foreground px-8 py-3 rounded-lg font-medium transition-colors">
              View Examples
            </button>
          </div>

          {/* Feature cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <div className="p-6 border border-border rounded-lg bg-card text-card-foreground">
              <h3 className="text-xl font-semibold mb-3">AI Magic Spark</h3>
              <p className="text-muted-foreground">
                Get instant tool suggestions tailored to your expertise and audience needs.
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg bg-card text-card-foreground">
              <h3 className="text-xl font-semibold mb-3">Logic Architect</h3>
              <p className="text-muted-foreground">
                Build sophisticated calculation frameworks with AI-powered logic design.
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg bg-card text-card-foreground">
              <h3 className="text-xl font-semibold mb-3">Style Master</h3>
              <p className="text-muted-foreground">
                Create beautiful, branded interfaces that match your professional identity.
              </p>
            </div>
          </div>

          {/* Demo section */}
          <div className="mt-16 p-8 border border-border rounded-lg bg-card text-card-foreground">
            <h2 className="text-2xl font-bold mb-4">Dark Mode Demo</h2>
            <p className="text-muted-foreground mb-4">
              Use the theme toggle in the top-right corner to switch between light, dark, and system themes.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-background border border-border rounded">
                Background
              </div>
              <div className="p-3 bg-primary text-primary-foreground rounded">
                Primary
              </div>
              <div className="p-3 bg-secondary text-secondary-foreground rounded">
                Secondary
              </div>
              <div className="p-3 bg-accent text-accent-foreground rounded">
                Accent
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
