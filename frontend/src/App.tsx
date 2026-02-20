import { Routes, Route } from 'react-router-dom'
import { Home, GridGame, ConnectionsGame } from './pages'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/grid" element={<GridGame />} />
      <Route path="/connections" element={<ConnectionsGame />} />
    </Routes>
  )
}

export default App
