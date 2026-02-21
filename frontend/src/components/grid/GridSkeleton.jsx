import { Fragment } from 'react'

/**
 * Loading skeleton that mimics the Grid board layout (4x4: corner + column labels + row labels + 9 cells).
 */
export default function GridSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-px w-full max-w-md mx-auto aspect-square max-h-[min(90vw,28rem)] animate-pulse">
      <div className="aspect-square bg-ufc-card/50 rounded-sm" />
      {[0, 1, 2].map((c) => (
        <div
          key={`col-${c}`}
          className="aspect-square bg-ufc-gold/10 border border-ufc-gold/20 rounded-sm"
        />
      ))}
      {[0, 1, 2].map((r) => (
        <Fragment key={r}>
          <div className="aspect-square bg-ufc-gold/10 border border-ufc-gold/20 rounded-sm" />
          {[0, 1, 2].map((c) => (
            <div
              key={`cell-${r}-${c}`}
              className="aspect-square bg-ufc-card border border-ufc-border rounded-sm"
            />
          ))}
        </Fragment>
      ))}
    </div>
  )
}
