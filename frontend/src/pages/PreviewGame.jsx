import { useParams, Navigate } from 'react-router-dom'
import GridGame from './GridGame'
import ConnectionsGame from './ConnectionsGame'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default function PreviewGame() {
  const { gameType, date } = useParams()

  if (import.meta.env.VITE_PREVIEW_MODE !== 'true') {
    return <Navigate to="/" replace />
  }

  const validDate = date && DATE_RE.test(date)
  const validGameType = gameType === 'grid' || gameType === 'connections'

  if (!validDate || !validGameType) {
    return (
      <div className="min-h-screen bg-ufc-dark text-ufc-text flex flex-col items-center justify-center p-4">
        <p className="text-ufc-muted">
          {!validDate && date ? `Invalid date: use YYYY-MM-DD (e.g. ${new Date().toISOString().slice(0, 10)})` : null}
          {!validGameType && gameType ? 'Game type must be grid or connections' : null}
          {(!date || !gameType) ? 'Missing gameType or date in URL: /preview/:gameType/:date' : null}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ufc-dark text-ufc-text">
      <div
        className="bg-red-600 text-white text-center py-2 px-4 font-bold text-sm uppercase tracking-wider"
        role="status"
        aria-live="polite"
      >
        PREVIEW MODE — {gameType} · {date}
      </div>
      {gameType === 'grid' && <GridGame previewDate={date} />}
      {gameType === 'connections' && <ConnectionsGame previewDate={date} />}
    </div>
  )
}
