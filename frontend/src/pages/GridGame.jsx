import { useState, useEffect, useRef } from 'react'
import { getDailyPuzzle, submitScore } from '../services/api'
import { useUser } from '../context'
import { useGridGame } from '../hooks'
import { Navbar, Modal, ShareButton } from '../components/shared'
import { GridBoard, CellModal, GridSkeleton } from '../components/grid'

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

export default function GridGame() {
  const { userId, streak, markGameCompleted } = useUser()
  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const completionHandled = useRef(false)

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
  } = useGridGame(puzzle ?? {})

  useEffect(() => {
    let cancelled = false
    getDailyPuzzle('grid')
      .then((data) => {
        if (cancelled) return
        // Backend returns { gameType, puzzle, difficulty, puzzleDate }; puzzle is null when none for that date
        const p = data?.puzzle ?? data
        setPuzzle(p != null ? p : null)
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
  }, [])

  useEffect(() => {
    if (!(gameWon || gameOver) || completionHandled.current || !userId) return
    completionHandled.current = true
    markGameCompleted('grid')
    const puzzleDate = todayYYYYMMDD()
    submitScore({
      anonymousUserId: userId,
      gameType: 'grid',
      puzzleDate,
      score,
      completed: gameWon,
      attempts: 9 - attemptsLeft,
    }).catch(() => {})
  }, [gameWon, gameOver, userId, score, attemptsLeft, markGameCompleted])

  const puzzleColumns = puzzle?.columns ?? ['', '', '']
  const puzzleRows = puzzle?.rows ?? ['', '', '']
  const rowLabel = selectedCell != null ? puzzleRows[selectedCell.row] : ''
  const colLabel = selectedCell != null ? puzzleColumns[selectedCell.col] : ''
  const showResultModal = gameWon || gameOver
  const shareText = gameWon
    ? `UFC Grid ${todayYYYYMMDD()} ✅ Score: ${score}/900`
    : ''

  if (loading) {
    return (
      <div className="min-h-screen bg-ufc-dark text-ufc-text">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <header className="text-center mb-6">
            <div className="h-4 w-32 mx-auto bg-ufc-card rounded animate-pulse" />
            <div className="h-8 w-48 mx-auto bg-ufc-gold/20 rounded mt-3 animate-pulse" />
            <div className="flex justify-center gap-1 mt-3">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <span key={i} className="w-4 h-4 bg-ufc-border rounded-full" />
              ))}
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

  return (
    <div className="min-h-screen bg-ufc-dark text-ufc-text">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <header className="text-center mb-6">
          <p className="text-ufc-muted text-sm">{todayFormatted()}</p>
          <h1 className="font-display text-3xl text-ufc-gold tracking-wide mt-1">DAILY GRID</h1>
          <div className="flex items-center justify-center gap-1 mt-3" aria-label={`${attemptsLeft} attempts left`}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <span
                key={i}
                className="w-4 h-4 flex items-center justify-center text-xs"
                title={i < attemptsLeft ? 'Attempt remaining' : 'Used'}
              >
                {i < attemptsLeft ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-ufc-gold fill-current" aria-hidden>
                    <polygon points="12 2 22 8 22 16 12 22 2 16 2 8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-ufc-muted" aria-hidden>
                    <polygon points="12 2 22 8 22 16 12 22 2 16 2 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                )}
              </span>
            ))}
          </div>
        </header>

        <GridBoard
          puzzle={puzzle ?? {}}
          board={board}
          onCellClick={selectCell}
          lockedCells={lockedCells}
          shakingCell={lastFailedCell}
        />

        <CellModal
          isOpen={selectedCell != null}
          onClose={closeCell}
          rowLabel={rowLabel}
          colLabel={colLabel}
          onFighterSelect={submitFighter}
          excludeNames={usedFighterNames}
        />

        {showResultModal && (
          <Modal isOpen onClose={() => {}} title={null}>
            <div className="space-y-4">
              <h2 className="font-display text-2xl text-ufc-gold">
                {gameWon ? 'GREAT WORK!' : 'GAME OVER'}
              </h2>
              {gameWon ? (
                <>
                  <p className="text-ufc-text">Score: {score}/900</p>
                  <ShareButton resultText={shareText} />
                </>
              ) : (
                <div>
                  <p className="text-ufc-muted text-sm mb-2">Correct answers:</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {(puzzle?.solution?.flat() ?? board.flat()).map((f, i) => (
                      <div
                        key={i}
                        className="bg-ufc-border rounded p-2 text-ufc-text truncate"
                        title={typeof f === 'string' ? f : f?.name}
                      >
                        {typeof f === 'string' ? f : (f?.name ?? '—')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-ufc-muted text-sm">Streak: {streak} day{streak !== 1 ? 's' : ''}</p>
              <p className="text-ufc-muted text-sm">Come back tomorrow</p>
            </div>
          </Modal>
        )}
      </main>
    </div>
  )
}
