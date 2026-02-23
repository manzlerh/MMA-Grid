import { useEffect, useState } from 'react'
import { useUser } from '../../context'
import Modal from './Modal'
import ShareButton from './ShareButton'

const DISTRIBUTION_KEYS = ['under200', '200to400', '400to600', '600to800', 'over800']
const DISTRIBUTION_LABELS = ['<200', '200-399', '400-599', '600-799', '800+']
const BUCKET_MAX = [200, 400, 600, 800, Infinity]

function getBucketIndex(score) {
  if (score == null || Number.isNaN(score)) return -1
  for (let i = 0; i < BUCKET_MAX.length; i++) {
    if (score < BUCKET_MAX[i]) return i
  }
  return DISTRIBUTION_KEYS.length - 1
}

function formatTime(seconds) {
  if (seconds == null || seconds < 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function getNextMidnightUTC() {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return new Date(today.getTime() + 24 * 60 * 60 * 1000)
}

function formatCountdown(ms) {
  if (ms <= 0) return '0:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Compute "you scored better than X% of players" from distribution buckets.
 * Returns 0-100 (integer). Uses buckets strictly below player's bucket.
 */
function betterThanPercent(score, scoreDistribution) {
  if (!scoreDistribution) return null
  const total = DISTRIBUTION_KEYS.reduce((sum, k) => sum + (scoreDistribution[k] ?? 0), 0)
  if (total === 0) return null
  const bucketIndex = getBucketIndex(score)
  if (bucketIndex <= 0) return 0
  let below = 0
  for (let i = 0; i < bucketIndex; i++) {
    below += scoreDistribution[DISTRIBUTION_KEYS[i]] ?? 0
  }
  return Math.round((100 * below) / total)
}

export default function ResultModal({
  isOpen,
  onClose,
  gameType,
  won,
  score,
  attempts,
  timeSeconds,
  dailyStats,
  shareText,
  onViewStats,
}) {
  const { stats } = useUser()
  const currentStreak = stats?.currentStreak ?? 0
  const [countdown, setCountdown] = useState('0:00:00')

  useEffect(() => {
    if (!isOpen) return
    const tick = () => {
      const next = getNextMidnightUTC()
      setCountdown(formatCountdown(next.getTime() - Date.now()))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isOpen])

  const dist = dailyStats?.scoreDistribution ?? {}
  const totalCompleters = DISTRIBUTION_KEYS.reduce((sum, k) => sum + (dist[k] ?? 0), 0)
  const playerBucketIndex = getBucketIndex(score)
  const betterThan = betterThanPercent(score, dist)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={null}>
      <div className="space-y-5 pt-2">
        {/* Header */}
        <div className="text-center">
          <p className="text-4xl mb-2" aria-hidden>
            {won ? '✅' : '❌'}
          </p>
          <h2
            className={`font-display text-3xl tracking-wide ${
              won ? 'text-ufc-gold' : 'text-red-500'
            }`}
          >
            {won ? 'GREAT WORK!' : 'GAME OVER'}
          </h2>
        </div>

        {/* Your result row */}
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <span className="text-ufc-text">
            <span className="text-ufc-muted uppercase tracking-wider">Score:</span>{' '}
            <strong className="tabular-nums">{score ?? '—'}</strong>
          </span>
          <span className="text-ufc-text">
            <span className="text-ufc-muted uppercase tracking-wider">Attempts:</span>{' '}
            <strong className="tabular-nums">{attempts ?? '—'}</strong>
          </span>
          {timeSeconds != null && (
            <span className="text-ufc-text">
              <span className="text-ufc-muted uppercase tracking-wider">Time:</span>{' '}
              <strong className="tabular-nums">{formatTime(timeSeconds)}</strong>
            </span>
          )}
        </div>

        {/* Community comparison */}
        {dailyStats != null && (
          <div className="rounded-lg bg-ufc-dark/60 border border-ufc-border p-3 text-ufc-muted">
            <p className="text-xs uppercase tracking-wider mb-2">
              Today&apos;s puzzle — {dailyStats.totalPlayers} players
            </p>
            <div className="flex h-6 rounded overflow-hidden bg-ufc-card mb-2">
              {DISTRIBUTION_KEYS.map((key, i) => {
                const n = dist[key] ?? 0
                const pct = totalCompleters > 0 ? (100 * n) / totalCompleters : 0
                const isPlayerBucket = i === playerBucketIndex
                return (
                  <div
                    key={key}
                    className="transition-colors"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: isPlayerBucket ? 'rgb(212 175 55)' : 'rgb(55 65 81)',
                    }}
                    title={`${DISTRIBUTION_LABELS[i]}: ${n}`}
                  />
                )
              })}
            </div>
            {betterThan != null && (
              <p className="text-xs">
                You scored better than {betterThan}% of players today.
              </p>
            )}
          </div>
        )}

        {/* Streak */}
        <div className="text-center">
          {currentStreak > 1 ? (
            <p className="text-ufc-gold font-display text-lg">
              🔥 {currentStreak} Day Streak
            </p>
          ) : (
            <p className="text-ufc-muted text-sm">
              Start your streak — come back tomorrow!
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          <ShareButton resultText={shareText} />
          <button
            type="button"
            onClick={() => {
              onClose()
              onViewStats?.()
            }}
            className="px-4 py-2 rounded-lg border border-ufc-border text-ufc-text hover:bg-ufc-card transition-colors text-sm font-medium"
          >
            VIEW STATS
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-ufc-border text-ufc-text hover:bg-ufc-card transition-colors text-sm font-medium"
          >
            CLOSE
          </button>
        </div>

        {/* Next puzzle countdown */}
        <div className="text-center pt-2 border-t border-ufc-border">
          <p className="text-ufc-muted text-xs uppercase tracking-wider">
            Next puzzle in: <span className="font-display text-ufc-gold tabular-nums">{countdown}</span>
          </p>
        </div>
      </div>
    </Modal>
  )
}
