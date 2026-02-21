/**
 * Loading skeleton that mimics the Connections board: banner area + 4x4 grid of cards.
 */
export default function ConnectionsSkeleton() {
  return (
    <div className="space-y-4 w-full max-w-2xl mx-auto animate-pulse">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg h-16 md:h-20 bg-ufc-card border border-ufc-border"
          />
        ))}
      </div>
    </div>
  )
}
