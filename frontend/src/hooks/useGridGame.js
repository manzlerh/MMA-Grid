import { useState, useCallback, useMemo } from 'react'
import { validateGridAnswer } from '../services/api'

const emptyBoard = () => [
  [null, null, null],
  [null, null, null],
  [null, null, null],
]

/**
 * @param {object} puzzle - daily puzzle data
 * @param {{ puzzleDate?: string }} [options] - optional puzzleDate (YYYY-MM-DD) for preview validation
 */
export function useGridGame(puzzle, options = {}) {
  const { puzzleDate } = options
  const [board, setBoard] = useState(emptyBoard)
  const [selectedCell, setSelectedCell] = useState(null)
  const [lockedCells, setLockedCells] = useState(() => new Set())
  const [attemptsLeft, setAttemptsLeft] = useState(3)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [gameWon, setGameWon] = useState(false)
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
        const { valid, fighter: validatedFighter } = await validateGridAnswer(
          { row, col },
          fighter.name,
          puzzleDate ? { puzzleDate } : {}
        )
        if (valid && validatedFighter) {
          setBoard((prev) => {
            const next = prev.map((r) => [...r])
            next[row][col] = validatedFighter
            return next
          })
          setLockedCells((prev) => {
            const next = new Set([...prev, key])
            if (next.size === 9) setGameWon(true)
            return next
          })
          setScore((s) => s + (100 - (3 - attemptsLeft) * 15))
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
    [selectedCell, gameOver, gameWon, attemptsLeft, puzzleDate]
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
