import { useState, useCallback, useEffect } from 'react'

function fisherYatesShuffle(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildInitialFighters(puzzle) {
  const groups = puzzle?.groups ?? []
  const all = groups.flatMap((g) => g.fighters ?? []).filter(Boolean)
  return fisherYatesShuffle(all)
}

function findGroupForFighters(puzzle, fighterIds) {
  const idSet = new Set(fighterIds)
  const groups = puzzle?.groups ?? []
  for (const group of groups) {
    const groupIds = (group.fighters ?? []).map((f) => f.id)
    const match = groupIds.length === 4 && groupIds.every((id) => idSet.has(id))
    if (match) return group
  }
  return null
}

function countMaxInSameGroup(puzzle, fighterIds) {
  const groups = puzzle?.groups ?? []
  let max = 0
  for (const group of groups) {
    const groupIds = new Set((group.fighters ?? []).map((f) => f.id))
    const count = fighterIds.filter((id) => groupIds.has(id)).length
    max = Math.max(max, count)
  }
  return max
}

export function useConnectionsGame(puzzle) {
  const [fighters, setFighters] = useState(() => buildInitialFighters(puzzle ?? {}))
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [solvedGroups, setSolvedGroups] = useState([])
  const [mistakesLeft, setMistakesLeft] = useState(5)
  const [gameOver, setGameOver] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [lastGuessWrong, setLastGuessWrong] = useState(false)
  const [isOneAway, setIsOneAway] = useState(false)

  // Set initial 16 fighters when puzzle first loads (only when current fighters empty)
  useEffect(() => {
    const groups = puzzle?.groups ?? []
    const all = groups.flatMap((g) => g.fighters ?? []).filter(Boolean)
    if (all.length !== 16) return
    setFighters((prev) => (prev.length === 0 ? fisherYatesShuffle(all) : prev))
  }, [puzzle?.groups])

  // Reset lastGuessWrong after 600ms
  useEffect(() => {
    if (!lastGuessWrong) return
    const t = setTimeout(() => {
      setLastGuessWrong(false)
      setIsOneAway(false)
    }, 600)
    return () => clearTimeout(t)
  }, [lastGuessWrong])

  const toggleFighter = useCallback((fighter) => {
    if (!fighter?.id || gameOver || gameWon) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(fighter.id)) next.delete(fighter.id)
      else if (next.size < 4) next.add(fighter.id)
      return next
    })
  }, [gameOver, gameWon])

  const submitGuess = useCallback(() => {
    if (selectedIds.size !== 4 || gameOver || gameWon) return
    const ids = Array.from(selectedIds)
    const group = findGroupForFighters(puzzle, ids)
    if (group) {
      setSolvedGroups((prev) => {
        const next = [...prev, group]
        if (next.length === 4) setGameWon(true)
        return next
      })
      setFighters((prev) => prev.filter((f) => !ids.includes(f.id)))
      setSelectedIds(new Set())
    } else {
      const maxInGroup = countMaxInSameGroup(puzzle, ids)
      setIsOneAway(maxInGroup === 3)
      setLastGuessWrong(true)
      setMistakesLeft((n) => {
        const next = n - 1
        if (next <= 0) setGameOver(true)
        return next
      })
    }
  }, [selectedIds, puzzle, gameOver, gameWon, solvedGroups.length])

  const shuffleRemaining = useCallback(() => {
    setFighters((prev) => fisherYatesShuffle(prev))
  }, [])

  return {
    fighters,
    selectedIds,
    solvedGroups,
    mistakesLeft,
    gameOver,
    gameWon,
    lastGuessWrong,
    isOneAway,
    toggleFighter,
    submitGuess,
    shuffleRemaining,
  }
}
