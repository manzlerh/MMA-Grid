import { Routes, Route } from 'react-router-dom'
import { Home, GridGame, ConnectionsGame, PreviewGame, NotFound } from './pages'
import ErrorBoundary from './components/shared/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/grid" element={<GridGame />} />
        <Route path="/connections" element={<ConnectionsGame />} />
        <Route path="/preview/:gameType/:date" element={<PreviewGame />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
