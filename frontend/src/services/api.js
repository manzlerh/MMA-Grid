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
 * GET /daily?gameType={gameType}
 * @param {'grid' | 'connections'} gameType
 * @returns {Promise<object>} puzzle object
 */
export async function getDailyPuzzle(gameType) {
  const { data } = await api.get('/daily', { params: { gameType } })
  return data
}

/**
 * POST /validate with body { cell: {row, col}, fighterName }
 * @param {{ row: number, col: number }} cell
 * @param {string} fighterName
 * @returns {Promise<{ valid: boolean, fighter: object | null }>}
 */
export async function validateGridAnswer(cell, fighterName) {
  const { data } = await api.post('/validate', { cell, fighterName })
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
