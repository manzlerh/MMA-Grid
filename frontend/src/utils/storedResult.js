const RESULT_KEY_PREFIX = 'ufc_result_'

/**
 * @param {'grid' | 'connections'} gameType
 * @param {string} date YYYY-MM-DD
 * @returns {object | null} { score, attempts, won, shareText, completedAt [, board] } or null
 */
export function getStoredResult(gameType, date) {
  if (!date) return null
  try {
    const key = `${RESULT_KEY_PREFIX}${gameType}_${date}`
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * @param {'grid' | 'connections'} gameType
 * @param {string} date YYYY-MM-DD
 * @param {{ score: number, attempts: number, won: boolean, shareText: string, completedAt: string, board?: (object|null)[][] }} payload
 */
export function setStoredResult(gameType, date, payload) {
  if (!date) return
  try {
    const key = `${RESULT_KEY_PREFIX}${gameType}_${date}`
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (_) {}
}
