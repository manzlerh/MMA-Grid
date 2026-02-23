import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getDailyPuzzle, getDailyLeaderboard } from '../services/api'
import { useUser } from '../context'
import { useConnectionsGame } from '../hooks'
import { generateConnectionsShareText } from '../utils/shareText'
import { Navbar, ResultModal, StatsModal } from '../components/shared'
import { ConnectionsBoard, MistakeTracker, ConnectionsSkeleton } from '../components/connections'

const GROUP_COLORS = {
  yellow: 'bg-yellow-400 text-yellow-950',
  green: 'bg-green-500 text-white',
  blue: 'bg-blue-500 text-white',
  purple: 'bg-purple-600 text-white',
}

const CONNECTIONS_COLOR_ORDER = ['yellow', 'green', 'blue', 'purple']

/**
 * Normalize API puzzle (categories + all_fighters with names) into shape expected by useConnectionsGame:
 * groups with label, color, and fighters as { id, name } objects.
 */
function normalizeConnectionsPuzzle(raw) {
  if (!raw || typeof raw !== 'object') return null
  const categories = raw.categories
  if (!Array.isArray(categories) || categories.length !== 4) return null
  const groups = categories.map((cat, idx) => {
    const names = Array.isArray(cat.fighters) ? cat.fighters : []
    return {
      label: cat.name ?? `Category ${idx + 1}`,
      name: cat.name,
      color: CONNECTIONS_COLOR_ORDER[idx] ?? 'yellow',
      fighters: names.map((name) => ({ id: name, name })),
    }
  })
  return { groups }
}

function todayFormatted() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function todayYYYYMMDD() {
  return new Date().toISOString().slice(0, 10)
}

export default function ConnectionsGame({ previewDate }) {
  const { userId, streak, markGameCompleted, saveScore } = useUser()
  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const completionHandled = useRef(false)
  const gameStartTime = useRef(null)
  const [dailyStats, setDailyStats] = useState(null)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [finalTimeSeconds, setFinalTimeSeconds] = useState(null)
  const effectiveDate = previewDate || todayYYYYMMDD()

  const {
    fighters,
    selectedIds,
    solvedGroups,
    mistakesLeft,
    gameOver,
    gameWon,
    isOneAway,
    toggleFighter,
    submitGuess,
    shuffleRemaining,
    deselectAll,
  } = useConnectionsGame(puzzle ?? {})

  useEffect(() => {
    let cancelled = false
    getDailyPuzzle('connections', previewDate ? { date: previewDate } : {})
      .then((data) => {
        if (cancelled) return
        const raw = data?.puzzle ?? data
        const normalized = normalizeConnectionsPuzzle(raw) ?? (raw && typeof raw === 'object' ? raw : null)
        setPuzzle(normalized)
        if (normalized) gameStartTime.current = Date.now()
      })
      .catch(() => {
        if (!cancelled) setPuzzle(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [previewDate])

  useEffect(() => {
    if (previewDate) return // no score submission in preview
    if (!(gameWon || gameOver) || completionHandled.current || !userId) return
    completionHandled.current = true
    markGameCompleted('connections')
    const puzzleDate = todayYYYYMMDD()
    const mistakesUsed = 5 - mistakesLeft
    const timeSeconds =
      gameStartTime.current != null
        ? Math.floor((Date.now() - gameStartTime.current) / 1000)
        : undefined
    setFinalTimeSeconds(timeSeconds ?? null)
    const score = gameWon ? Math.max(0, 1000 - 150 * mistakesUsed) : 0
    saveScore({
      anonymousUserId: userId,
      gameType: 'connections',
      puzzleDate,
      score,
      completed: gameWon,
      attempts: mistakesUsed,
      timeSeconds,
    })
      .then(() => getDailyLeaderboard('connections', puzzleDate))
      .then((data) => setDailyStats(data ?? null))
      .catch(() => {})
  }, [gameWon, gameOver, userId, mistakesLeft, markGameCompleted, saveScore, previewDate])

  const canSubmit = selectedIds.size === 4
  const showResultModal = gameWon || gameOver
  const mistakesUsed = 5 - mistakesLeft
  const connectionsScore = gameWon ? Math.max(0, 1000 - 150 * mistakesUsed) : 0
  useEffect(() => {
    if (showResultModal) setResultModalOpen(true)
  }, [showResultModal])

  const shareText =
    showResultModal
      ? generateConnectionsShareText({
          won: gameWon,
          mistakes: mistakesUsed,
          solvedGroups,
          puzzleDate: effectiveDate,
        })
      : ''

  if (loading) {
    return (
      <div className="min-h-screen bg-ufc-dark text-ufc-text">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <header className="text-center mb-6">
            <div className="h-4 w-32 mx-auto bg-ufc-card rounded animate-pulse" />
            <div className="h-8 w-52 mx-auto bg-ufc-gold/20 rounded mt-3 animate-pulse" />
            <p className="text-ufc-muted text-sm mt-2 h-4 w-56 mx-auto bg-ufc-card rounded animate-pulse" />
          </header>
          <ConnectionsSkeleton />
          <p className="text-center text-ufc-muted text-sm mt-4">Loading today&apos;s puzzle...</p>
        </main>
      </div>
    )
  }

  if (puzzle == null || !puzzle.groups?.length) {
    return (
      <div className="min-h-screen bg-ufc-dark text-ufc-text">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="font-display text-2xl text-ufc-gold tracking-wide">DAILY CONNECTIONS</h1>
          <p className="text-ufc-muted mt-2">No puzzle for today. Check back later.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ufc-dark text-ufc-text">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <header className="text-center mb-6">
          <p className="text-ufc-muted text-sm">{previewDate ? effectiveDate : todayFormatted()}</p>
          <h1 className="font-display text-3xl text-ufc-gold tracking-wide mt-1">
            DAILY CONNECTIONS
          </h1>
          <p className="text-ufc-muted text-sm mt-2">
            Select 4 fighters with something in common
          </p>
        </header>

        <div className="flex justify-center mb-4">
          <MistakeTracker mistakesLeft={mistakesLeft} maxMistakes={5} />
        </div>

        <ConnectionsBoard
          fighters={fighters}
          selectedIds={selectedIds}
          solvedGroups={solvedGroups}
          onFighterToggle={toggleFighter}
        />

        <div className="flex flex-wrap justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={shuffleRemaining}
            className="px-4 py-2 rounded-lg border border-ufc-border text-ufc-text hover:bg-ufc-card transition-colors text-sm font-medium"
          >
            SHUFFLE
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="px-4 py-2 rounded-lg border border-ufc-border text-ufc-text hover:bg-ufc-card transition-colors text-sm font-medium"
          >
            DESELECT ALL
          </button>
          <button
            type="button"
            onClick={submitGuess}
            disabled={!canSubmit}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              canSubmit
                ? 'bg-ufc-gold text-ufc-dark hover:bg-ufc-gold/90'
                : 'bg-ufc-border text-ufc-muted cursor-not-allowed'
            }`}
          >
            SUBMIT
          </button>
        </div>

        <AnimatePresence>
          {isOneAway && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-ufc-gold/20 border border-ufc-gold text-ufc-gold text-sm font-medium"
            >
              ONE AWAY...
            </motion.div>
          )}
        </AnimatePresence>

        <ResultModal
          isOpen={resultModalOpen}
          onClose={() => setResultModalOpen(false)}
          gameType="connections"
          won={gameWon}
          score={connectionsScore}
          attempts={mistakesUsed}
          timeSeconds={finalTimeSeconds ?? undefined}
          dailyStats={dailyStats}
          shareText={shareText}
          onViewStats={() => {
            setResultModalOpen(false)
            setStatsModalOpen(true)
          }}
        />
        <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} />
      </main>
    </div>
  )
}
