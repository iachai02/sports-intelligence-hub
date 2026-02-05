import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { DraftOptimizer } from './components/DraftOptimizer'
import { DraftRoom } from './pages/DraftRoom'
import { PlayerStats } from './pages/PlayerStats'
import { AuthCallback } from './pages/AuthCallback'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeToggle } from './components/ThemeToggle'
import { AuthButton } from './components/AuthButton'

function HomePage() {
  return (
    <div className="min-h-screen py-8 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Sports Intelligence Hub</h1>
          <div className="flex items-center gap-4">
            <AuthButton />
            <ThemeToggle />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Draft Optimizer Card */}
          <Link
            to="/optimizer"
            className="block p-6 bg-card rounded-lg shadow hover:shadow-lg transition border border-border"
          >
            <h2 className="text-xl font-semibold mb-2 text-foreground">Draft Optimizer</h2>
            <p className="text-muted-foreground">
              Use linear programming to find the optimal roster within your budget constraints.
            </p>
          </Link>

          {/* Draft Room Card */}
          <Link
            to="/draft-room"
            className="block p-6 bg-card rounded-lg shadow hover:shadow-lg transition border border-border"
          >
            <h2 className="text-xl font-semibold mb-2 text-foreground">Draft Room</h2>
            <p className="text-muted-foreground">
              Live auction draft assistant with real-time recommendations and roster tracking.
            </p>
          </Link>

          {/* Player Stats Browser Card */}
          <Link
            to="/stats"
            className="block p-6 bg-card rounded-lg shadow hover:shadow-lg transition border border-border"
          >
            <h2 className="text-xl font-semibold mb-2 text-foreground">Player Stats Browser</h2>
            <p className="text-muted-foreground">
              Browse, search, filter, and compare NBA player statistics.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}

function OptimizerPage() {
  return (
    <div className="min-h-screen py-8 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <Link to="/" className="text-accent hover:underline">
            &larr; Back to Home
          </Link>
          <div className="flex items-center gap-4">
            <AuthButton />
            <ThemeToggle />
          </div>
        </div>
        <DraftOptimizer />
      </div>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/optimizer" element={<OptimizerPage />} />
            <Route path="/draft-room" element={<DraftRoom />} />
            <Route path="/stats" element={<PlayerStats />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
