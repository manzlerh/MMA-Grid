const MAX_MISTAKES = 3

/** Octagon shape for one life/mistake indicator (viewBox 0 0 24 24, center 12,12) */
const octagonPoints = '12 2 19 5 22 12 19 19 12 22 5 19 2 12 5 5'

export default function MistakeTracker({ mistakesLeft = 0, maxMistakes = MAX_MISTAKES }) {
  const count = Math.min(Math.max(0, mistakesLeft), maxMistakes)
  const total = Math.min(maxMistakes, MAX_MISTAKES)

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-ufc-muted text-xs uppercase tracking-wider">
        MISTAKES REMAINING
      </p>
      <div className="flex gap-1.5" role="status" aria-label={`${count} of ${total} mistakes remaining`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="w-4 h-4 flex items-center justify-center flex-shrink-0"
            title={i < count ? 'Mistake remaining' : 'Used'}
          >
            {i < count ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-ufc-gold fill-current" aria-hidden>
                <polygon points={octagonPoints} stroke="currentColor" strokeWidth="1.5" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-ufc-muted" aria-hidden>
                <polygon points={octagonPoints} stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
