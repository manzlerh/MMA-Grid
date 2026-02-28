import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useUser } from '../../context'
import StatsModal from './StatsModal'

export default function Navbar() {
  const [showStats, setShowStats] = useState(false)
  const { stats } = useUser()
  const currentStreak = stats?.currentStreak ?? 0

  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-colors ${
      isActive
        ? 'bg-ufc-gold text-ufc-dark'
        : 'text-ufc-text hover:bg-ufc-red/20 border border-ufc-border'
    }`

  return (
    <header className="bg-ufc-card border-b border-ufc-border">
      <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <NavLink to="/" className="font-display text-2xl text-ufc-gold tracking-wide flex items-center">
          <img src="/MMA Grid Icon 2.svg" alt="" className="h-6 w-6 shrink-0 mr-2" aria-hidden />
          MMA TRIVIA
        </NavLink>
        <div className="flex items-center gap-2">
          <NavLink to="/grid" className={linkClass}>
            GRID
          </NavLink>
          <NavLink to="/connections" className={linkClass}>
            CONNECTIONS
          </NavLink>
          <button
            type="button"
            onClick={() => setShowStats(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-ufc-text hover:bg-ufc-red/20 border border-ufc-border transition-colors"
            aria-label="View stats"
          >
            <svg
              className="w-5 h-5 text-ufc-gold"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {currentStreak > 1 && (
              <span className="text-ufc-gold font-medium tabular-nums">🔥{currentStreak}</span>
            )}
          </button>
        </div>
      </nav>
      <StatsModal isOpen={showStats} onClose={() => setShowStats(false)} />
    </header>
  )
}
