import { Routes, Route } from 'react-router-dom'
import { Home, GridGame, ConnectionsGame, PreviewGame } from './pages'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/grid" element={<GridGame />} />
      <Route path="/connections" element={<ConnectionsGame />} />
      <Route path="/preview/:gameType/:date" element={<PreviewGame />} />
    </Routes>
  )
}

export default App
