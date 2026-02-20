import { Link } from 'react-router-dom'
import { useUser } from '../context'
import { Navbar } from '../components/shared'

export default function Home() {
  const { streak, gamesPlayed, todayCompleted } = useUser()
  // Best score could come from API/user context later
  const bestScore = '—'

  return (
    <div className="min-h-screen bg-ufc-dark text-ufc-text">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <section className="text-center mb-12">
          <h1 className="font-display text-5xl sm:text-6xl text-ufc-gold tracking-wide">
            UFC TRIVIA
          </h1>
          <p className="text-ufc-muted mt-3 text-lg">Daily UFC knowledge challenges</p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          <GameCard
            to="/grid"
            title="Grid"
            description="Fill the 3×3 grid by matching fighters to row and column attributes."
            completed={todayCompleted.grid}
            streak={streak}
          />
          <GameCard
            to="/connections"
            title="Connections"
            description="Group four fighters that share a common connection."
            completed={todayCompleted.connections}
            streak={streak}
          />
        </section>

        <section className="border-t border-ufc-border pt-6">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-ufc-muted uppercase tracking-wider">Games Played</p>
              <p className="text-ufc-text font-semibold mt-1">{gamesPlayed}</p>
            </div>
            <div>
              <p className="text-ufc-muted uppercase tracking-wider">Best Score</p>
              <p className="text-ufc-text font-semibold mt-1">{bestScore}</p>
            </div>
            <div>
              <p className="text-ufc-muted uppercase tracking-wider">Current Streak</p>
              <p className="text-ufc-text font-semibold mt-1">🔥 {streak} day{streak !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function GameCard({ to, title, description, completed, streak }) {
  return (
    <div className="bg-ufc-card border border-ufc-border rounded-lg p-6 relative flex flex-col">
      <div className="absolute top-4 right-4">
        {completed ? (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-400 border border-green-500/50" title="Completed today">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : (
          <span
            className="inline-block w-3 h-3 rounded-full bg-ufc-red animate-pulse"
            title="Not played today"
          />
        )}
      </div>
      <h2 className="font-display text-2xl text-ufc-gold mb-2">{title}</h2>
      <p className="text-ufc-muted text-sm flex-1 mb-4">{description}</p>
      <p className="text-ufc-muted text-xs mb-4">🔥 {streak} day{streak !== 1 ? 's' : ''} streak</p>
      <Link
        to={to}
        className="inline-flex items-center justify-center w-full py-3 rounded-lg bg-ufc-gold text-ufc-dark font-semibold hover:bg-ufc-gold/90 transition-colors"
      >
        PLAY
      </Link>
    </div>
  )
}
