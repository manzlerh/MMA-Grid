/**
 * Dev-only helpers. Only used when import.meta.env.DEV is true (Vite dev server).
 */

export const isDev = import.meta.env.DEV

/** @param {string} yyyyMmDd - YYYY-MM-DD */
export function dayBefore(yyyyMmDd) {
  const d = new Date(yyyyMmDd + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** @param {string} yyyyMmDd - YYYY-MM-DD */
export function dayAfter(yyyyMmDd) {
  const d = new Date(yyyyMmDd + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** @param {string} yyyyMmDd - YYYY-MM-DD */
export function formatDateForDisplay(yyyyMmDd) {
  return new Date(yyyyMmDd + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
