import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getDailyPuzzle, getDailyLeaderboard } from '../services/api'
import { useUser } from '../context'
import { useConnectionsGame } from '../hooks'
import { generateConnectionsShareText } from '../utils/shareText'
import { getStoredResult, setStoredResult } from '../utils/storedResult'
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

function getNextPuzzleCountdown() {
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const nextMidnightUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000)
  const ms = nextMidnightUTC.getTime() - Date.now()
  if (ms <= 0) return '0:00:00'
  const s = Math.floor(ms / 1000) % 60
  const m = Math.floor(ms / 60000) % 60
  const h = Math.floor(ms / 3600000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function ConnectionsGame({ previewDate }) {
  const { userId, todayCompleted, markGameCompleted, saveScore } = useUser()
  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const completionHandled = useRef(false)
  const gameStartTime = useRef(null)
  const [dailyStats, setDailyStats] = useState(null)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [finalTimeSeconds, setFinalTimeSeconds] = useState(null)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const [storedResult, setStoredResultState] = useState(null)
  const [countdown, setCountdown] = useState('0:00:00')
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
    if (previewDate || !puzzle?.groups?.length) return
    const completed = todayCompleted?.connections || getStoredResult('connections', effectiveDate)
    if (completed) {
      setAlreadyPlayed(true)
      setStoredResultState(getStoredResult('connections', effectiveDate))
      setResultModalOpen(true)
    }
  }, [puzzle, previewDate, effectiveDate, todayCompleted?.connections])

  useEffect(() => {
    if (!alreadyPlayed) return
    const tick = () => setCountdown(getNextPuzzleCountdown())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [alreadyPlayed])

  useEffect(() => {
    if (alreadyPlayed && effectiveDate) {
      getDailyLeaderboard('connections', effectiveDate)
        .then((data) => setDailyStats(data ?? null))
        .catch(() => {})
    }
  }, [alreadyPlayed, effectiveDate])

  useEffect(() => {
    if (previewDate) return // no score submission in preview
    if (!(gameWon || gameOver) || completionHandled.current || !userId) return
    completionHandled.current = true
    markGameCompleted('connections')
    const puzzleDate = todayYYYYMMDD()
    const mistakesUsed = 3 - mistakesLeft
    const timeSeconds =
      gameStartTime.current != null
        ? Math.floor((Date.now() - gameStartTime.current) / 1000)
        : undefined
    setFinalTimeSeconds(timeSeconds ?? null)
    const score = gameWon ? Math.max(0, 1000 - 150 * mistakesUsed) : 0
    const shareTextForStorage = generateConnectionsShareText({
      won: gameWon,
      mistakes: mistakesUsed,
      solvedGroups,
      puzzleDate: effectiveDate,
    })
    setStoredResult('connections', puzzleDate, {
      score,
      attempts: mistakesUsed,
      won: gameWon,
      shareText: shareTextForStorage,
      completedAt: new Date().toISOString(),
    })
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
  }, [gameWon, gameOver, userId, mistakesLeft, markGameCompleted, saveScore, previewDate, solvedGroups, effectiveDate])

  const canSubmit = selectedIds.size === 4
  const showResultModal = gameWon || gameOver
  const mistakesUsed = 3 - mistakesLeft
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

  const resultForModal = alreadyPlayed ? storedResult : null
  const displaySolvedGroups = alreadyPlayed ? (puzzle?.groups ?? []) : solvedGroups

  return (
    <div className="min-h-screen bg-ufc-dark text-ufc-text">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        {alreadyPlayed && (
          <div className="mb-6 rounded-lg bg-ufc-card border border-ufc-border p-4 space-y-3">
            <h2 className="font-display text-xl text-ufc-gold tracking-wide text-center">
              YOU ALREADY PLAYED TODAY
            </h2>
            {resultForModal?.shareText && (
              <pre className="p-3 rounded bg-ufc-dark text-ufc-text text-xs md:text-sm overflow-x-auto whitespace-pre-wrap font-sans border border-ufc-border">
                {resultForModal.shareText}
              </pre>
            )}
            {resultForModal && (
              <p className="text-ufc-muted text-sm text-center">
                Score: {resultForModal.score} | Attempts: {resultForModal.attempts}
              </p>
            )}
            <p className="text-ufc-muted text-xs text-center">
              Next puzzle in: <span className="font-display text-ufc-gold tabular-nums">{countdown}</span>
            </p>
          </div>
        )}

        <header className="text-center mb-6">
          <p className="text-ufc-muted text-sm">{previewDate ? effectiveDate : todayFormatted()}</p>
          <h1 className="font-display text-3xl text-ufc-gold tracking-wide mt-1">
            DAILY CONNECTIONS
          </h1>
          {!alreadyPlayed && (
            <p className="text-ufc-muted text-sm mt-2">
              Select 4 fighters with something in common
            </p>
          )}
        </header>

        {!alreadyPlayed && (
          <div className="flex justify-center mb-4">
            <MistakeTracker mistakesLeft={mistakesLeft} maxMistakes={3} />
          </div>
        )}

        <ConnectionsBoard
          fighters={fighters}
          selectedIds={selectedIds}
          solvedGroups={displaySolvedGroups}
          onFighterToggle={alreadyPlayed ? () => {} : toggleFighter}
        />

        {!alreadyPlayed && (
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
        )}

        <AnimatePresence>
          {!alreadyPlayed && isOneAway && (
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
          won={resultForModal?.won ?? gameWon}
          score={resultForModal?.score ?? connectionsScore}
          attempts={resultForModal?.attempts ?? mistakesUsed}
          timeSeconds={resultForModal ? undefined : (finalTimeSeconds ?? undefined)}
          dailyStats={dailyStats}
          shareText={resultForModal?.shareText ?? shareText}
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
