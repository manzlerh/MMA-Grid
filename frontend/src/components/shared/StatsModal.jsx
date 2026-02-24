import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useUser } from '../../context'
import Modal from './Modal'

const BAR_COLOR_COMPLETED = '#C79B2E'
const BAR_COLOR_FAILED = '#D20A0A'

function formatPuzzleDate(isoDate) {
  if (!isoDate) return '—'
  try {
    const d = new Date(isoDate + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return isoDate
  }
}

function shortDateLabel(isoDate) {
  if (!isoDate) return ''
  try {
    const d = new Date(isoDate + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return isoDate
  }
}

/**
 * Build chart data from recentGames: group by date, max score per date, last 14 days.
 * @param {Array<{ puzzleDate: string, score: number, completed: boolean }>} recentGames
 * @returns {Array<{ date: string, dateFull: string, score: number, completed: boolean }>}
 */
function buildScoreHistoryData(recentGames) {
  if (!Array.isArray(recentGames) || recentGames.length === 0) return []
  const byDate = new Map()
  for (const g of recentGames) {
    const d = g.puzzleDate
    if (!d) continue
    const score = g.score != null && !Number.isNaN(Number(g.score)) ? Number(g.score) : 0
    const existing = byDate.get(d)
    if (!existing) {
      byDate.set(d, { date: d, score, completed: !!g.completed })
    } else {
      if (score > existing.score) existing.score = score
      if (g.completed) existing.completed = true
    }
  }
  const sorted = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14)
  return sorted.reverse().map(([, v]) => ({
    date: shortDateLabel(v.date),
    dateFull: formatPuzzleDate(v.date),
    score: v.score,
    completed: v.completed,
  }))
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
  const chartData = useMemo(() => buildScoreHistoryData(recentGames), [recentGames])
  const showChart = chartData.length >= 3

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
              <GameBreakdown
                stats={activeTab === 'grid' ? stats?.gridStats : stats?.connectionsStats}
              />
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

        {/* Section 4 — Score history (last 14 days) */}
        <div>
          <p className="text-ufc-muted text-xs uppercase tracking-wider mb-2">Score history (last 14 days)</p>
          {statsLoading ? (
            <div className="h-[120px] rounded-lg bg-ufc-card border border-ufc-border flex items-center justify-center">
              <div className="h-16 w-full max-w-[80%] bg-ufc-border rounded animate-pulse" />
            </div>
          ) : !showChart ? (
            <div className="h-[120px] rounded-lg bg-ufc-card border border-ufc-border flex items-center justify-center">
              <p className="text-ufc-muted text-sm">Play more games to see your history</p>
            </div>
          ) : (
            <div className="h-[120px] rounded-lg border border-ufc-border bg-ufc-card p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#374151' }}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                    labelStyle={{ color: '#d4af37' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload
                      return (
                        <div className="px-2 py-1 text-sm">
                          <p className="text-ufc-gold font-medium">{p.dateFull}</p>
                          <p className="text-ufc-text">Score: {p.score}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="score" radius={4} maxBarSize={32}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.completed ? BAR_COLOR_COMPLETED : BAR_COLOR_FAILED}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
