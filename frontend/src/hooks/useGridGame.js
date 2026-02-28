import { useState, useCallback, useMemo } from 'react'
import { validateGridAnswer } from '../services/api'

const emptyBoard = () => [
  [null, null, null],
  [null, null, null],
  [null, null, null],
]

/**
 * @param {object} puzzle - daily puzzle data
 * @param {{ puzzleDate?: string, initialState?: object }} [options] - puzzleDate for validation; initialState to restore (board, lockedCells array, attemptsLeft, score, gameOver, gameWon)
 */
export function useGridGame(puzzle, options = {}) {
  const { puzzleDate, initialState } = options
  const [board, setBoard] = useState(() => {
    if (initialState?.board && Array.isArray(initialState.board) && initialState.board.length === 3) {
      return initialState.board.map((row) => (Array.isArray(row) ? row.map((c) => c ?? null) : [null, null, null]))
    }
    return emptyBoard()
  })
  const [selectedCell, setSelectedCell] = useState(null)
  const [lockedCells, setLockedCells] = useState(() => {
    if (initialState?.lockedCells && Array.isArray(initialState.lockedCells)) {
      return new Set(initialState.lockedCells)
    }
    return new Set()
  })
  const [attemptsLeft, setAttemptsLeft] = useState(() => initialState?.attemptsLeft ?? 3)
  const [score, setScore] = useState(() => initialState?.score ?? 0)
  const [gameOver, setGameOver] = useState(() => !!initialState?.gameOver)
  const [gameWon, setGameWon] = useState(() => !!initialState?.gameWon)
  const [isValidating, setIsValidating] = useState(false)
  const [lastFailedCell, setLastFailedCell] = useState(null)

  const selectCell = useCallback(
    (row, col) => {
      if (gameOver) return
      const key = `${row},${col}`
      setLockedCells((prev) => {
        if (prev.has(key)) return prev
        setSelectedCell({ row, col })
        return prev
      })
    },
    [gameOver]
  )

  const closeCell = useCallback(() => {
    setSelectedCell(null)
  }, [])

  const submitFighter = useCallback(
    async (fighter) => {
      if (!selectedCell || !fighter?.name || gameOver || gameWon) return
      const { row, col } = selectedCell
      const key = `${row},${col}`

      setIsValidating(true)
      try {
        const { valid, fighter: validatedFighter, popularity: userPopularity } = await validateGridAnswer(
          { row, col },
          fighter.name,
          puzzleDate ? { puzzleDate } : {}
        )
        if (valid && validatedFighter) {
          const cells = puzzle?.cells || {}
          const cellMeta = cells[key]
          const minPop = cellMeta?.min_popularity
          const userPop = typeof userPopularity === 'number' && userPopularity > 0 ? userPopularity : 0.15
          const points = minPop != null
            ? Math.min(100, Math.round(100 * (minPop / userPop)))
            : (100 - (3 - attemptsLeft) * 15)
          setBoard((prev) => {
            const next = prev.map((r) => [...r])
            next[row][col] = { ...validatedFighter, cellScore: points }
            return next
          })
          setLockedCells((prev) => {
            const next = new Set([...prev, key])
            if (next.size === 9) setGameWon(true)
            return next
          })
          setScore((s) => s + points)
          setSelectedCell(null)
        } else {
          setLastFailedCell({ row, col })
          setTimeout(() => setLastFailedCell(null), 600)
          setAttemptsLeft((n) => {
            const next = n - 1
            if (next <= 0) setGameOver(true)
            return next
          })
        }
      } finally {
        setIsValidating(false)
      }
    },
    [selectedCell, gameOver, gameWon, attemptsLeft, puzzleDate, puzzle]
  )

  const usedFighterNames = useMemo(() => {
    return board.flat().filter(Boolean).map((f) => f.name)
  }, [board])

  return {
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
  }
}
