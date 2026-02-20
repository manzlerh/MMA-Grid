import { Fragment } from 'react'
import { motion } from 'framer-motion'

const shakeVariants = {
  shake: {
    x: [0, -6, 6, -6, 6, 0],
    transition: { duration: 0.4 },
  },
  idle: { x: 0 },
}

export default function GridBoard({ puzzle = {}, board = [], onCellClick, lockedCells = new Set(), shakingCell = null }) {
  const columns = puzzle.columns ?? ['', '', '']
  const rows = puzzle.rows ?? ['', '', '']
  const lockedSet = lockedCells instanceof Set ? lockedCells : new Set(lockedCells ?? [])

  const isLocked = (r, c) => lockedSet.has(`${r},${c}`)
  const getCell = (r, c) => (board[r] && board[r][c]) ?? null

  return (
    <div className="grid grid-cols-4 gap-px w-full max-w-md mx-auto aspect-square max-h-[min(90vw,28rem)]">
      {/* [0,0] empty corner */}
      <div className="aspect-square bg-ufc-dark" />
      {/* Top row: column labels */}
      {[0, 1, 2].map((c) => (
        <div
          key={`col-${c}`}
          className="aspect-square bg-ufc-gold/10 border border-ufc-gold/30 flex items-center justify-center text-ufc-gold font-semibold text-sm text-center p-1"
        >
          {columns[c] ?? ''}
        </div>
      ))}
      {/* Rows 1–3: row label + 3 cells */}
      {[0, 1, 2].map((r) => (
        <Fragment key={r}>
          <div
            className="aspect-square bg-ufc-gold/10 border border-ufc-gold/30 flex items-center justify-center text-ufc-gold font-semibold text-sm text-center p-1"
          >
            {rows[r] ?? ''}
          </div>
          {[0, 1, 2].map((c) => {
            const fighter = getCell(r, c)
            const locked = isLocked(r, c)
            const isEmpty = !fighter
            const isShaking = shakingCell?.row === r && shakingCell?.col === c
            const CellWrapper = isShaking ? motion.div : Fragment
            const wrapperProps = isShaking
              ? { animate: 'shake', variants: shakeVariants, className: 'aspect-square' }
              : {}
            return (
              <CellWrapper key={`wrap-${r}-${c}`} {...wrapperProps}>
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={!isEmpty}
                  onClick={() => isEmpty && onCellClick?.(r, c)}
                  className={`w-full aspect-square flex items-center justify-center text-center p-1 transition-colors
                    ${isEmpty
                      ? 'bg-ufc-card border border-ufc-border cursor-pointer hover:border-ufc-red text-ufc-text'
                      : 'bg-ufc-red/90 border border-ufc-red text-white'}
                    ${locked ? 'ring-2 ring-green-500/80 ring-inset' : ''}
                  `}
                >
                  {fighter?.name ?? ''}
                </button>
              </CellWrapper>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
