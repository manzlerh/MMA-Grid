import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const api = axios.create({ baseURL })

/**
 * GET /fighters/search?q={query}
 * @param {string} query
 * @returns {Promise<{ fighters: Array }>}
 */
export async function searchFighters(query) {
  const { data } = await api.get('/fighters/search', { params: { q: query } })
  return data
}

/**
 * GET /daily?gameType={gameType}&date=YYYY-MM-DD
 * @param {'grid' | 'connections'} gameType
 * @param {{ date?: string }} [opts] optional date (YYYY-MM-DD); if omitted, client sends today UTC so server and client agree on "today"
 * @returns {Promise<{ gameType, puzzle, difficulty, puzzleDate? }>}
 */
export async function getDailyPuzzle(gameType, opts = {}) {
  const params = { gameType }
  if (opts.date) params.date = opts.date
  else params.date = new Date().toISOString().slice(0, 10) // client's today in UTC
  const { data } = await api.get('/daily', { params })
  return data
}

/**
 * POST /validate with body { cell: {row, col}, fighterName, puzzleDate? }
 * @param {{ row: number, col: number }} cell
 * @param {string} fighterName
 * @param {{ puzzleDate?: string }} [opts] optional puzzleDate (YYYY-MM-DD) for preview mode
 * @returns {Promise<{ valid: boolean, fighter: object | null }>}
 */
export async function validateGridAnswer(cell, fighterName, opts = {}) {
  const body = { cell, fighterName }
  if (opts.puzzleDate) body.puzzleDate = opts.puzzleDate
  const { data } = await api.post('/validate', body)
  return data
}

/**
 * POST /scores
 * @param {{ anonymousUserId: string, gameType: string, puzzleDate: string, score: number, completed: boolean, attempts: number, timeSeconds?: number }} payload
 * @returns {Promise<object>}
 */
export async function submitScore(payload) {
  const { data } = await api.post('/scores', payload)
  return data
}

/**
 * GET /scores/stats/{anonymousUserId}
 * @param {string} anonymousUserId
 * @returns {Promise<object>} streak and score history
 */
export async function getUserStats(anonymousUserId) {
  const { data } = await api.get(`/scores/stats/${anonymousUserId}`)
  return data
}
