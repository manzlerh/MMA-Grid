import { Fragment } from 'react'
import { motion } from 'framer-motion'

const shakeVariants = {
  shake: {
    x: [0, -6, 6, -6, 6, 0],
    transition: { duration: 0.4 },
  },
  idle: { x: 0 },
}

const labelClass =
  'aspect-square bg-ufc-gold/10 border border-ufc-gold/30 flex items-center justify-center text-ufc-gold font-semibold text-xs md:text-sm text-center p-1 overflow-hidden'

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
      {/* Top row: column labels — wrap so full text is visible */}
      {[0, 1, 2].map((c) => (
        <div key={`col-${c}`} className={labelClass} title={columns[c] ?? ''}>
          <span className="block w-full break-words leading-tight">
            {columns[c] ?? ''}
          </span>
        </div>
      ))}
      {/* Rows 1–3: row label + 3 cells */}
      {[0, 1, 2].map((r) => (
        <Fragment key={r}>
          <div className={labelClass} title={rows[r] ?? ''}>
            <span className="block w-full break-words leading-tight">
              {rows[r] ?? ''}
            </span>
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
            const cellContent = (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={!isEmpty}
                onClick={() => isEmpty && onCellClick?.(r, c)}
                title={fighter?.name ?? ''}
                className={`w-full aspect-square flex items-center justify-center text-center p-1 transition-colors text-xs md:text-sm overflow-hidden
                  ${isEmpty
                    ? 'bg-ufc-card border border-ufc-border cursor-pointer hover:border-ufc-red text-ufc-text'
                    : 'bg-ufc-red/90 border border-ufc-red text-white'}
                  ${locked ? 'ring-2 ring-green-500/80 ring-inset' : ''}
                `}
              >
                <span className="block w-full break-words leading-tight">
                  {fighter?.name ?? ''}
                </span>
              </button>
            )
            if (!isEmpty) {
              return (
                <CellWrapper key={`wrap-${r}-${c}`} {...wrapperProps}>
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="aspect-square w-full"
                  >
                    {cellContent}
                  </motion.div>
                </CellWrapper>
              )
            }
            return <CellWrapper key={`wrap-${r}-${c}`} {...wrapperProps}>{cellContent}</CellWrapper>
          })}
        </Fragment>
      ))}
    </div>
  )
}
