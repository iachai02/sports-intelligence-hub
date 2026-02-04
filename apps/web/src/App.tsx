import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { DraftOptimizer } from './components/DraftOptimizer'
import { DraftRoom } from './pages/DraftRoom'

function HomePage() {
  return (
    <div className="min-h-screen py-8 bg-gray-100">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Sports Intelligence Hub</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Draft Optimizer Card */}
          <Link
            to="/optimizer"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold mb-2">Draft Optimizer</h2>
            <p className="text-gray-600">
              Use linear programming to find the optimal roster within your budget constraints.
            </p>
          </Link>

          {/* Draft Room Card */}
          <Link
            to="/draft-room"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold mb-2">Draft Room</h2>
            <p className="text-gray-600">
              Live auction draft assistant with real-time recommendations and roster tracking.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}

function OptimizerPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to Home
        </Link>
        <DraftOptimizer />
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/optimizer" element={<OptimizerPage />} />
        <Route path="/draft-room" element={<DraftRoom />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
