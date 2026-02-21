const MAX_DOTS = 5

export default function MistakeTracker({ mistakesLeft = 0, maxMistakes = MAX_DOTS }) {
  const count = Math.min(Math.max(0, mistakesLeft), maxMistakes)
  const total = Math.min(maxMistakes, MAX_DOTS)

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-ufc-muted text-xs uppercase tracking-wider">
        Mistakes remaining
      </p>
      <div className="flex gap-1.5" role="status" aria-label={`${count} of ${total} mistakes remaining`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`
              w-2.5 h-2.5 rounded-full transition-colors
              ${i < count ? 'bg-ufc-gold' : 'bg-ufc-border'}
            `}
          />
        ))}
      </div>
    </div>
  )
}
