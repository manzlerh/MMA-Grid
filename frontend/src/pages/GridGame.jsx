import { useState, useEffect, useRef } from 'react'
import { getDailyPuzzle, getDailyLeaderboard } from '../services/api'
import { useUser } from '../context'
import { useGridGame } from '../hooks'
import { generateGridShareText } from '../utils/shareText'
import { getStoredResult, setStoredResult } from '../utils/storedResult'
import { getGameState, setGameState, clearGameState } from '../utils/gameState'
import { todayEST, getNextPuzzleCountdownEST } from '../utils/dailyPuzzleDate'
import { Navbar, ResultModal, StatsModal } from '../components/shared'
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
  const effectiveDate = previewDate || todayEST()
  const completedResult = getStoredResult('grid', effectiveDate)
  const initialGridState = (previewDate || completedResult) ? null : getGameState('grid', effectiveDate)

  const {
    board,
    selectedCell,
    lockedCells,
    attemptsLeft,
    score,
    gameOver,
    gameWon,
    isValidating,
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
    let cancelled = false
    getDailyPuzzle('grid', previewDate ? { date: previewDate } : {})
      .then((data) => {
        if (cancelled) return
        // Backend returns { gameType, puzzle, difficulty, puzzleDate }; puzzle is null when none for that date
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
  }, [previewDate])

  useEffect(() => {
    if (previewDate || !puzzle) return
    const completed = todayCompleted?.grid || getStoredResult('grid', effectiveDate)
    if (completed) {
      setAlreadyPlayed(true)
      setStoredResultState(getStoredResult('grid', effectiveDate))
      setResultModalOpen(true)
    }
  }, [puzzle, previewDate, effectiveDate, todayCompleted?.grid])

  // Persist in-progress grid state so it survives tab switch / refresh
  useEffect(() => {
    if (previewDate || alreadyPlayed || gameWon || gameOver || !effectiveDate) return
    setGameState('grid', effectiveDate, {
      board,
      lockedCells: [...lockedCells],
      attemptsLeft,
      score,
      gameOver,
      gameWon,
    })
  }, [board, lockedCells, attemptsLeft, score, gameOver, gameWon, previewDate, alreadyPlayed, effectiveDate])

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

  useEffect(() => {
    if (previewDate) return // no score submission in preview
    if (!(gameWon || gameOver) || completionHandled.current || !userId) return
    completionHandled.current = true
    markGameCompleted('grid')
    const puzzleDate = todayEST()
    const timeSeconds =
      gameStartTime.current != null
        ? Math.floor((Date.now() - gameStartTime.current) / 1000)
        : undefined
    setFinalTimeSeconds(timeSeconds ?? null)
    const attempts = 3 - attemptsLeft
    const shareTextForStorage = generateGridShareText({
      won: gameWon,
      score,
      attempts,
      board,
      puzzleDate: effectiveDate,
    })
    setStoredResult('grid', puzzleDate, {
      score,
      attempts,
      won: gameWon,
      shareText: shareTextForStorage,
      completedAt: new Date().toISOString(),
      board: board.map((row) => row.map((c) => (c ? { name: c.name } : null))),
    })
    clearGameState('grid', puzzleDate)
    saveScore({
      anonymousUserId: userId,
      gameType: 'grid',
      puzzleDate,
      score,
      completed: gameWon,
      attempts,
      timeSeconds,
    })
      .then(() => getDailyLeaderboard('grid', puzzleDate))
      .then((data) => setDailyStats(data ?? null))
      .catch(() => {})
  }, [gameWon, gameOver, userId, score, attemptsLeft, markGameCompleted, saveScore, previewDate, board, effectiveDate])

  const puzzleColumns = puzzle?.columns ?? ['', '', '']
  const puzzleRows = puzzle?.rows ?? ['', '', '']
  const rowLabel = selectedCell != null ? puzzleRows[selectedCell.row] : ''
  const colLabel = selectedCell != null ? puzzleColumns[selectedCell.col] : ''
  const showResultModal = gameWon || gameOver
  useEffect(() => {
    if (showResultModal) setResultModalOpen(true)
  }, [showResultModal])

  const shareText =
    showResultModal
      ? generateGridShareText({
          won: gameWon,
          score,
          attempts: 3 - attemptsLeft,
          board,
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
    return (
      <div className="min-h-screen bg-ufc-dark text-ufc-text">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="font-display text-2xl text-ufc-gold tracking-wide">DAILY GRID</h1>
          <p className="text-ufc-muted mt-2">
            {loadError ? 'Failed to load the puzzle. Check your connection and try again.' : 'No puzzle for today. Check back later or try another date.'}
          </p>
        </main>
      </div>
    )
  }

  const displayBoard = alreadyPlayed && storedResult?.board ? storedResult.board : board
  const resultForModal = alreadyPlayed ? storedResult : null

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
                Score: {resultForModal.score} | Attempts: {resultForModal.attempts}/3
              </p>
            )}
            <p className="text-ufc-muted text-xs text-center">
              Next puzzle in: <span className="font-display text-ufc-gold tabular-nums">{countdown}</span>
            </p>
          </div>
        )}

        <header className="text-center mb-6">
          <p className="text-ufc-muted text-sm">{previewDate ? effectiveDate : todayFormatted()}</p>
          <h1 className="font-display text-3xl text-ufc-gold tracking-wide mt-1">DAILY GRID</h1>
          {!alreadyPlayed && (
            <div className="mt-3">
              <MistakeTracker mistakesLeft={attemptsLeft} maxMistakes={3} />
            </div>
          )}
        </header>

        <GridBoard
          puzzle={puzzle ?? {}}
          board={displayBoard}
          onCellClick={alreadyPlayed || gameOver ? () => {} : selectCell}
          lockedCells={alreadyPlayed ? ALL_GRID_CELLS : lockedCells}
          shakingCell={alreadyPlayed ? null : lastFailedCell}
          gameOver={gameOver}
        />

        {!alreadyPlayed && (
          <CellModal
            isOpen={selectedCell != null}
            onClose={closeCell}
            rowLabel={rowLabel}
            colLabel={colLabel}
            onFighterSelect={submitFighter}
            excludeNames={usedFighterNames}
          />
        )}

        <ResultModal
          isOpen={resultModalOpen}
          onClose={() => setResultModalOpen(false)}
          gameType="grid"
          won={resultForModal?.won ?? gameWon}
          score={resultForModal?.score ?? score}
          attempts={resultForModal?.attempts ?? 3 - attemptsLeft}
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
