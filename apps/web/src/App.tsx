import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { DraftOptimizer } from './components/DraftOptimizer'
import { DraftRoom } from './pages/DraftRoom'
import { PlayerStats } from './pages/PlayerStats'
import { DashboardPage } from './pages/DashboardPage'
import { AuthCallback } from './pages/AuthCallback'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { GlobalNavBar } from './components/GlobalNavBar'

function OptimizerPage() {
  return (
    <div className="min-h-[calc(100vh-3rem)] py-8 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <DraftOptimizer />
      </div>
    </div>
  )
}

function AppLayout() {
  const location = useLocation()
  const hideNav = location.pathname === '/auth/callback'

  return (
    <>
      {!hideNav && <GlobalNavBar />}
      <Outlet />
    </>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/optimizer" element={<OptimizerPage />} />
              <Route path="/draft-room" element={<DraftRoom />} />
              <Route path="/stats" element={<PlayerStats />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
