/**
 * Base URL for "Play at:" link. Uses current origin in browser.
 */
function getPlayUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'https://mma-grid.example.com'
}

/**
 * Format puzzle date (YYYY-MM-DD) as "Feb 24".
 */
function formatPuzzleDate(puzzleDate) {
  if (!puzzleDate) return ''
  try {
    const d = new Date(puzzleDate + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return puzzleDate
  }
}

const GRID_CORRECT = '✅'
const GRID_WRONG = '🟥'

/**
 * Generate share text for the Grid game.
 * @param {{ won: boolean, score: number, attempts: number, board: (object|null)[][], puzzleDate: string }}
 * @returns {string}
 */
export function generateGridShareText({ won, score, attempts, board, puzzleDate }) {
  const dateStr = formatPuzzleDate(puzzleDate)
  const lines = [
    `UFC TRIVIA — GRID 📅 ${dateStr}`,
    '',
  ]

  const grid = Array.isArray(board) ? board : []
  for (let row = 0; row < 3; row++) {
    const cells = []
    for (let col = 0; col < 3; col++) {
      const cell = grid[row]?.[col]
      cells.push(cell != null && typeof cell === 'object' ? GRID_CORRECT : GRID_WRONG)
    }
    lines.push(cells.join(' '))
  }

  lines.push('')
  lines.push(`Score: ${score ?? 0} | Attempts: ${attempts ?? 0}/9`)
  lines.push(`Play at: ${getPlayUrl()}`)

  return lines.join('\n')
}

const CONNECTIONS_SQUARES = {
  yellow: '🟨',
  green: '🟩',
  blue: '🟦',
  purple: '🟪',
}
const CONNECTIONS_UNSOLVED_ROW = '⬛⬛⬛⬛'

/**
 * Generate share text for the Connections game.
 * @param {{ won: boolean, mistakes: number, solvedGroups: Array<{ color?: string }>, puzzleDate: string }}
 * @returns {string}
 */
export function generateConnectionsShareText({ won, mistakes, solvedGroups, puzzleDate }) {
  const dateStr = formatPuzzleDate(puzzleDate)
  const lines = [
    `UFC TRIVIA — CONNECTIONS 📅 ${dateStr}`,
    '',
  ]

  const groups = Array.isArray(solvedGroups) ? solvedGroups : []
  for (const group of groups) {
    const color = (group.color || 'yellow').toLowerCase()
    const square = CONNECTIONS_SQUARES[color] ?? CONNECTIONS_SQUARES.yellow
    lines.push(`${square}${square}${square}${square}`)
  }

  if (!won) {
    const totalGroups = 4
    const unsolvedCount = totalGroups - groups.length
    for (let i = 0; i < unsolvedCount; i++) {
      lines.push(CONNECTIONS_UNSOLVED_ROW)
    }
  }

  lines.push('')
  lines.push(`Solved in order! Mistakes: ${mistakes ?? 0}`)
  lines.push(`Play at: ${getPlayUrl()}`)

  return lines.join('\n')
}
