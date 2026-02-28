/**
 * Persist in-progress game state (grid and connections) so it survives
 * tab switches and page refresh. Keyed by gameType and puzzle date.
 * Completed games are stored via storedResult; we clear in-progress state on complete.
 */

const STATE_KEY_PREFIX = 'ufc_game_state_'

/**
 * @param {'grid' | 'connections'} gameType
 * @param {string} date YYYY-MM-DD
 * @returns {object | null} Persisted in-progress state or null
 */
export function getGameState(gameType, date) {
  if (!date || !gameType) return null
  try {
    const key = `${STATE_KEY_PREFIX}${gameType}_${date}`
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
 * @param {object} state State to persist (will be JSON-serialized)
 */
export function setGameState(gameType, date, state) {
  if (!date || !gameType) return
  try {
    const key = `${STATE_KEY_PREFIX}${gameType}_${date}`
    localStorage.setItem(key, JSON.stringify(state))
  } catch (_) {}
}

/**
 * Remove in-progress state for a game/date (e.g. after completion).
 * @param {'grid' | 'connections'} gameType
 * @param {string} date YYYY-MM-DD
 */
export function clearGameState(gameType, date) {
  if (!date || !gameType) return
  try {
    const key = `${STATE_KEY_PREFIX}${gameType}_${date}`
    localStorage.removeItem(key)
  } catch (_) {}
}
