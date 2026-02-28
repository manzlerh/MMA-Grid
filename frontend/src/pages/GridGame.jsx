import { useState, useEffect, useRef, useCallback } from 'react'
import { getDailyPuzzle, getDailyLeaderboard } from '../services/api'
import { useUser } from '../context'
import { useGridGame } from '../hooks'
import { generateGridShareText } from '../utils/shareText'
import { getStoredResult, setStoredResult, clearStoredResult } from '../utils/storedResult'
import { getGameState, setGameState, clearGameState } from '../utils/gameState'
import { todayEST, getNextPuzzleCountdownEST } from '../utils/dailyPuzzleDate'
import { isDev, dayBefore, dayAfter, formatDateForDisplay } from '../utils/devUtils'
import { Navbar, ResultModal, StatsModal, SEOMeta } from '../components/shared'
import { GridBoard, CellModal, GridSkeleton } from '../components/grid'
import { MistakeTracker } from '../components/connections'

const ALL_GRID_CELLS = new Set(['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2'])

function todayFormatted() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}


export default function GridGame({ previewDate }) {
  const { userId, todayCompleted, markGameCompleted, saveScore } = useUser()
  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const completionHandled = useRef(false)
  const gameStartTime = useRef(null)
  const [dailyStats, setDailyStats] = useState(null)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [finalTimeSeconds, setFinalTimeSeconds] = useState(null)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const [storedResult, setStoredResultState] = useState(null)
  const [countdown, setCountdown] = useState('0:00:00')
  const [completionResult, setCompletionResult] = useState(null)
  const [devDateOverride, setDevDateOverride] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const effectiveDate = devDateOverride ?? previewDate ?? todayEST()
  const completedResult = getStoredResult('grid', effectiveDate)

  useEffect(() => {
    let cancelled = false
    const opts = (isDev && devDateOverride) || previewDate ? { date: effectiveDate } : {}
    getDailyPuzzle('grid', opts)
      .then((data) => {
        if (cancelled) return
        const p = data?.puzzle ?? data
        setPuzzle(p != null ? p : null)
        if (p) gameStartTime.current = Date.now()
      })
      .catch(() => {
        if (!cancelled) {
          setPuzzle(null)
          setLoadError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [effectiveDate, previewDate])

  useEffect(() => {
    if (previewDate || !puzzle) return
    const completedForThisDate = getStoredResult('grid', effectiveDate)
    const completedToday = effectiveDate === todayEST() && todayCompleted?.grid
    const completed = isDev ? !!completedForThisDate : (completedToday || completedForThisDate)
    if (completed) {
      setAlreadyPlayed(true)
      setStoredResultState(getStoredResult('grid', effectiveDate))
      setResultModalOpen(true)
    } else {
      setAlreadyPlayed(false)
      setStoredResultState(null)
    }
  }, [puzzle, previewDate, effectiveDate, todayCompleted?.grid])

  useEffect(() => {
    if (!alreadyPlayed) return
    const tick = () => setCountdown(getNextPuzzleCountdownEST())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [alreadyPlayed])

  useEffect(() => {
    if (alreadyPlayed && effectiveDate) {
      getDailyLeaderboard('grid', effectiveDate)
        .then((data) => setDailyStats(data ?? null))
        .catch(() => {})
    }
  }, [alreadyPlayed, effectiveDate])

  const handleComplete = useCallback(
    (result) => {
      if (completionHandled.current || !userId) return
      completionHandled.current = true
      markGameCompleted('grid')
      const puzzleDate = todayEST()
      const timeSeconds =
        gameStartTime.current != null
          ? Math.floor((Date.now() - gameStartTime.current) / 1000)
          : undefined
      setFinalTimeSeconds(timeSeconds ?? null)
      const attempts = 3 - result.attemptsLeft
      const shareTextForStorage = generateGridShareText({
        won: result.gameWon,
        score: result.score,
        attempts,
        board: result.board,
        puzzleDate: effectiveDate,
      })
      setStoredResult('grid', puzzleDate, {
        score: result.score,
        attempts,
        won: result.gameWon,
        shareText: shareTextForStorage,
        completedAt: new Date().toISOString(),
        board: result.board.map((row) => row.map((c) => (c ? { name: c.name, image_url: c.image_url, cellScore: c.cellScore } : null))),
      })
      clearGameState('grid', puzzleDate)
      saveScore({
        anonymousUserId: userId,
        gameType: 'grid',
        puzzleDate,
        score: result.score,
        completed: result.gameWon,
        attempts,
        timeSeconds,
      })
        .then(() => getDailyLeaderboard('grid', puzzleDate))
        .then((data) => setDailyStats(data ?? null))
        .catch(() => {})
      setCompletionResult(result)
      setResultModalOpen(true)
    },
    [userId, markGameCompleted, saveScore, effectiveDate]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-ufc-dark text-ufc-text">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <header className="text-center mb-6">
            <div className="h-4 w-32 mx-auto bg-ufc-card rounded animate-pulse" />
            <div className="h-8 w-48 mx-auto bg-ufc-gold/20 rounded mt-3 animate-pulse" />
            <div className="mt-3 flex justify-center">
              <MistakeTracker mistakesLeft={3} maxMistakes={3} />
            </div>
          </header>
          <GridSkeleton />
          <p className="text-center text-ufc-muted text-sm mt-4">Loading today&apos;s puzzle...</p>
        </main>
      </div>
    )
  }

  if (puzzle === null) {
    const noPuzzleDateLabel = (devDateOverride || previewDate) ? formatDateForDisplay(effectiveDate) : todayFormatted()
    return (
      <div className="min-h-screen bg-ufc-dark text-ufc-text">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <header className="text-center mb-6">
            <p className="text-ufc-muted text-sm flex items-center justify-center gap-2">
              {isDev && (
                <button
                  type="button"
                  onClick={() => setDevDateOverride(dayBefore(effectiveDate))}
                  className="p-0.5 rounded hover:bg-ufc-card text-ufc-muted hover:text-ufc-text"
                  aria-label="Previous day"
                >
                  ←
                </button>
              )}
              {noPuzzleDateLabel}
              {isDev && (
                <button
                  type="button"
                  onClick={() => setDevDateOverride(dayAfter(effectiveDate))}
                  className="p-0.5 rounded hover:bg-ufc-card text-ufc-muted hover:text-ufc-text"
                  aria-label="Next day"
                >
                  →
                </button>
              )}
            </p>
            <h1 className="font-display text-3xl text-ufc-gold tracking-wide mt-1 flex items-center justify-center gap-2">
              DAILY GRID
              {isDev && (
                <button
                  type="button"
                  onClick={() => { clearGameState('grid', effectiveDate); clearStoredResult('grid', effectiveDate); setAlreadyPlayed(false); setStoredResultState(null); setResetKey((k) => k + 1) }}
                  className="p-1 rounded hover:bg-ufc-card text-ufc-muted hover:text-ufc-text"
                  aria-label="Reset puzzle"
                  title="Reset puzzle (dev)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              )}
            </h1>
          </header>
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <p className="text-ufc-muted mt-2">
              {loadError ? 'Failed to load the puzzle. Check your connection and try again.' : 'No puzzle for this date. Check back later or try another date.'}
            </p>
          </div>
        </main>
      </div>
    )
  }

  const dateLabel = (devDateOverride || previewDate) ? formatDateForDisplay(effectiveDate) : todayFormatted()
  const resultForModal = alreadyPlayed ? storedResult : (completionResult
    ? {
        won: completionResult.gameWon,
        score: completionResult.score,
        attempts: 3 - completionResult.attemptsLeft,
        shareText: generateGridShareText({
          won: completionResult.gameWon,
          score: completionResult.score,
          attempts: 3 - completionResult.attemptsLeft,
          board: completionResult.board,
          puzzleDate: effectiveDate,
        }),
      }
    : null)

  return (
    <div className="min-h-screen bg-ufc-dark text-ufc-text">
      <SEOMeta
        title="MMA Grid — Daily Challenge"
        description="Fill the 3x3 grid with MMA fighters matching both row and column attributes. A new puzzle every day."
      />
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
                Score: {resultForModal.score} | Attempts: {resultForModal.attempts}/3
              </p>
            )}
            <p className="text-ufc-muted text-xs text-center">
              Next puzzle in: <span className="font-display text-ufc-gold tabular-nums">{countdown}</span>
            </p>
          </div>
        )}

        <header className="text-center mb-6">
          <p className="text-ufc-muted text-sm flex items-center justify-center gap-2">
            {isDev && (
              <button
                type="button"
                onClick={() => setDevDateOverride(dayBefore(effectiveDate))}
                className="p-0.5 rounded hover:bg-ufc-card text-ufc-muted hover:text-ufc-text"
                aria-label="Previous day"
              >
                ←
              </button>
            )}
            {dateLabel}
            {isDev && (
              <button
                type="button"
                onClick={() => setDevDateOverride(dayAfter(effectiveDate))}
                className="p-0.5 rounded hover:bg-ufc-card text-ufc-muted hover:text-ufc-text"
                aria-label="Next day"
              >
                →
              </button>
            )}
          </p>
          <h1 className="font-display text-3xl text-ufc-gold tracking-wide mt-1 flex items-center justify-center gap-2">
            DAILY GRID
            {isDev && (
              <button
                type="button"
                onClick={() => {
                  clearGameState('grid', effectiveDate)
                  clearStoredResult('grid', effectiveDate)
                  setAlreadyPlayed(false)
                  setStoredResultState(null)
                  setResetKey((k) => k + 1)
                }}
                className="p-1 rounded hover:bg-ufc-card text-ufc-muted hover:text-ufc-text"
                aria-label="Reset puzzle"
                title="Reset puzzle (dev)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            )}
          </h1>
        </header>

        {!alreadyPlayed ? (
          <GridGamePlay
            key={`grid-${effectiveDate}-${resetKey}`}
            puzzle={puzzle}
            effectiveDate={effectiveDate}
            previewDate={previewDate}
            completedResult={completedResult}
            storedResult={storedResult}
            onComplete={handleComplete}
          />
        ) : (
          <GridBoard
            puzzle={puzzle ?? {}}
            board={storedResult?.board ?? [[null, null, null], [null, null, null], [null, null, null]]}
            onCellClick={() => {}}
            lockedCells={ALL_GRID_CELLS}
            shakingCell={null}
            gameOver
          />
        )}

        <ResultModal
          isOpen={resultModalOpen}
          onClose={() => setResultModalOpen(false)}
          gameType="grid"
          won={resultForModal?.won ?? false}
          score={resultForModal?.score ?? 0}
          attempts={resultForModal?.attempts ?? 0}
          timeSeconds={resultForModal ? undefined : (finalTimeSeconds ?? undefined)}
          dailyStats={dailyStats}
          shareText={resultForModal?.shareText ?? ''}
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

function GridGamePlay({
  puzzle,
  effectiveDate,
  previewDate,
  completedResult,
  storedResult,
  onComplete,
}) {
  const initialGridState = (previewDate || completedResult) ? null : getGameState('grid', effectiveDate)
  const completionFired = useRef(false)
  const {
    board,
    selectedCell,
    lockedCells,
    attemptsLeft,
    score,
    gameOver,
    gameWon,
    lastFailedCell,
    selectCell,
    submitFighter,
    closeCell,
    usedFighterNames,
  } = useGridGame(puzzle ?? {}, {
    puzzleDate: previewDate || effectiveDate,
    initialState: initialGridState,
  })

  useEffect(() => {
    if (previewDate || gameWon || gameOver || !effectiveDate) return
    setGameState('grid', effectiveDate, {
      board,
      lockedCells: [...lockedCells],
      attemptsLeft,
      score,
      gameOver,
      gameWon,
    })
  }, [board, lockedCells, attemptsLeft, score, gameOver, gameWon, previewDate, effectiveDate])

  useEffect(() => {
    if (!(gameWon || gameOver) || completionFired.current) return
    completionFired.current = true
    onComplete({ gameWon, gameOver, board, score, attemptsLeft })
  }, [gameWon, gameOver, board, score, attemptsLeft, onComplete])

  const puzzleColumns = puzzle?.columns ?? ['', '', '']
  const puzzleRows = puzzle?.rows ?? ['', '', '']
  const rowLabel = selectedCell != null ? puzzleRows[selectedCell.row] : ''
  const colLabel = selectedCell != null ? puzzleColumns[selectedCell.col] : ''

  return (
    <>
      <div className="mt-3 flex justify-center mb-4">
        <MistakeTracker mistakesLeft={attemptsLeft} maxMistakes={3} />
      </div>
      <GridBoard
        puzzle={puzzle ?? {}}
        board={board}
        onCellClick={gameOver ? () => {} : selectCell}
        lockedCells={lockedCells}
        shakingCell={lastFailedCell}
        gameOver={gameOver}
      />
      <CellModal
        isOpen={selectedCell != null}
        onClose={closeCell}
        rowLabel={rowLabel}
        colLabel={colLabel}
        onFighterSelect={submitFighter}
        excludeNames={usedFighterNames}
      />
    </>
  )
}
