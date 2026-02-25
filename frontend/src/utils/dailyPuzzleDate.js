/**
 * Daily puzzle date and countdown in Eastern Time (America/New_York).
 * Used so "today" and "next puzzle" roll over at midnight EST.
 */

const TZ = 'America/New_York'

/**
 * Current date in Eastern Time as YYYY-MM-DD.
 * @returns {string}
 */
export function todayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/**
 * Milliseconds until the next midnight in Eastern Time.
 * @returns {number}
 */
export function msUntilMidnightEST() {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const [y, m, d] = todayStr.split('-').map(Number)
  const noonUTC = Date.UTC(y, m - 1, d, 12, 0, 0)
  const hourInNY = new Date(noonUTC).toLocaleString('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    hour12: false,
  })
  const offsetHours = 12 - parseInt(hourInNY, 10)
  const midnightTodayNY = noonUTC - offsetHours * 3600 * 1000
  const nextMidnightNY = midnightTodayNY + 24 * 3600 * 1000
  return nextMidnightNY - Date.now()
}

/**
 * Countdown string until next puzzle (midnight EST), e.g. "02:15:30".
 * @returns {string}
 */
export function getNextPuzzleCountdownEST() {
  const ms = msUntilMidnightEST()
  if (ms <= 0) return '0:00:00'
  const s = Math.floor(ms / 1000) % 60
  const m = Math.floor(ms / 60000) % 60
  const h = Math.floor(ms / 3600000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
