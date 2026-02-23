import { useState } from 'react'
import { useUser } from '../../context'
import Modal from './Modal'

function formatPuzzleDate(isoDate) {
  if (!isoDate) return '—'
  try {
    const d = new Date(isoDate + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return isoDate
  }
}

function StatBox({ label, value, loading }) {
  if (loading) {
    return (
      <div className="rounded-lg bg-ufc-card border border-ufc-border p-4">
        <div className="h-10 w-16 bg-ufc-border rounded animate-pulse" />
        <div className="h-3 w-20 mt-2 bg-ufc-border/60 rounded animate-pulse" />
      </div>
    )
  }
  return (
    <div className="rounded-lg bg-ufc-card border border-ufc-border p-4">
      <p className="font-display text-4xl text-white tabular-nums">{value}</p>
      <p className="text-ufc-muted text-xs uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

function GameBreakdown({ stats }) {
  const s = stats || {}
  const rows = [
    { label: 'Games Played', value: s.played ?? 0 },
    { label: 'Completed', value: s.completed ?? 0 },
    { label: 'Avg Score', value: s.avgScore ?? 0 },
    { label: 'Best Score', value: s.bestScore ?? 0 },
    { label: 'Avg Attempts', value: s.avgAttempts ?? 0 },
  ]
  return (
    <dl className="space-y-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex justify-between text-sm">
          <dt className="text-ufc-muted">{label}</dt>
          <dd className="text-ufc-text font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function StatsModal({ isOpen, onClose }) {
  const { stats, statsLoading } = useUser()
  const [activeTab, setActiveTab] = useState('grid')

  const recentGames = stats?.recentGames ?? []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your Stats">
      <div className="space-y-6 pt-2">
        {/* Section 1 — Headline numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="PLAYED" value={stats?.totalGamesPlayed ?? 0} loading={statsLoading} />
          <StatBox label="WIN %" value={stats?.completionRate ?? 0} loading={statsLoading} />
          <StatBox
            label="CURRENT STREAK"
            value={statsLoading ? '' : `${stats?.currentStreak ?? 0} 🔥`}
            loading={statsLoading}
          />
          <StatBox label="MAX STREAK" value={stats?.longestStreak ?? 0} loading={statsLoading} />
        </div>

        {/* Section 2 — Game breakdown tabs */}
        <div>
          <div className="flex gap-1 mb-3">
            {['grid', 'connections'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? 'bg-ufc-gold text-ufc-dark'
                    : 'bg-ufc-card border border-ufc-border text-ufc-muted hover:text-ufc-text'
                }`}
              >
                {tab === 'grid' ? 'Grid' : 'Connections'}
              </button>
            ))}
          </div>
          {statsLoading ? (
            <div className="rounded-lg bg-ufc-card border border-ufc-border p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-ufc-border rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-ufc-card border border-ufc-border p-4">
              <GameBreakdown(
                activeTab === 'grid' ? stats?.gridStats : stats?.connectionsStats
              )}
            </div>
          )}
        </div>

        {/* Section 3 — Recent games */}
        <div>
          <p className="text-ufc-muted text-xs uppercase tracking-wider mb-2">Recent games</p>
          <div className="rounded-lg border border-ufc-border bg-ufc-card max-h-[200px] overflow-y-auto">
            {statsLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-ufc-border rounded animate-pulse" />
                ))}
              </div>
            ) : recentGames.length === 0 ? (
              <p className="p-4 text-ufc-muted text-sm">No games played yet.</p>
            ) : (
              <ul className="divide-y divide-ufc-border">
                {recentGames.map((game, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 px-4 py-2 text-sm"
                  >
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        game.gameType === 'grid'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {game.gameType === 'grid' ? 'Grid' : 'Connections'}
                    </span>
                    <span className="text-ufc-muted shrink-0">
                      {formatPuzzleDate(game.puzzleDate)}
                    </span>
                    <span className="text-ufc-text tabular-nums ml-auto">{game.score ?? '—'}</span>
                    {game.completed ? (
                      <span className="text-green-500" aria-label="Completed">
                        ✓
                      </span>
                    ) : (
                      <span className="text-red-500/80" aria-label="Incomplete">
                        ✕
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
