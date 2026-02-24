import { Fragment, useState } from 'react'
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

function initials(name) {
  if (!name || typeof name !== 'string') return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name[0] || '?').toUpperCase()
}

function FilledCell({ fighter, locked, canInteract, onClick, isShaking }) {
  const [imageFailed, setImageFailed] = useState(false)
  const rawUrl = fighter?.image_url
  const sanitizedUrl =
    typeof rawUrl === 'string'
      ? rawUrl.replace(/^['"]+|['"]+$/g, '').trim()
      : ''
  const showHeadshot = !!sanitizedUrl && !imageFailed
  const CellWrapper = isShaking ? motion.div : Fragment
  const wrapperProps = isShaking
    ? { animate: 'shake', variants: shakeVariants, className: 'aspect-square' }
    : {}

  const content = (
    <button
      type="button"
      disabled
      title={fighter?.name ?? ''}
      className={`w-full aspect-square flex flex-col items-center justify-end text-center p-1 transition-colors text-xs md:text-sm overflow-hidden relative
        ${locked
          ? 'border border-green-500'
          : 'border border-ufc-red'}
      `}
      style={showHeadshot ? {
        backgroundImage: `url(${sanitizedUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {/* todo: remove this debug log */}
      {typeof window !== 'undefined' && console.log(
        '[Grid FilledCell] render',
        {
          name: fighter?.name,
          image_url: fighter?.image_url,
          sanitized: sanitizedUrl,
          showHeadshot,
          imageFailed,
        }
      )}
      {showHeadshot ? (
        <>
          <img
            src={sanitizedUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
            onError={(e) => {
              // todo: remove this debug log
              console.warn('[Grid FilledCell] image load error', {
                name: fighter?.name,
                image_url: fighter?.image_url,
                error: e?.nativeEvent?.message ?? 'unknown',
              })
              setImageFailed(true)
            }}
          />
          <span
            className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"
            aria-hidden
          />
          <span className="relative z-10 text-white font-semibold break-words leading-tight w-full">
            {fighter?.name ?? ''}
          </span>
        </>
      ) : (
        <span className={`w-full h-full flex items-center justify-center font-bold text-white ${locked ? 'bg-green-600' : 'bg-ufc-red/90'}`}>
          {initials(fighter?.name)}
        </span>
      )}
    </button>
  )

  return (
    <CellWrapper {...wrapperProps}>
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2 }}
        className="aspect-square w-full"
      >
        {content}
      </motion.div>
    </CellWrapper>
  )
}

export default function GridBoard({ puzzle = {}, board = [], onCellClick, lockedCells = new Set(), shakingCell = null, gameOver = false }) {
  const columns = puzzle.columns ?? ['', '', '']
  const rows = puzzle.rows ?? ['', '', '']
  const lockedSet = lockedCells instanceof Set ? lockedCells : new Set(lockedCells ?? [])

  const isLocked = (r, c) => lockedSet.has(`${r},${c}`)
  const getCell = (r, c) => (board[r] && board[r][c]) ?? null
  const canInteract = !gameOver

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

            if (!isEmpty) {
              return (
                <FilledCell
                  key={`${r}-${c}`}
                  fighter={fighter}
                  locked={locked}
                  canInteract={canInteract}
                  isShaking={isShaking}
                />
              )
            }

            const cellContent = (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={!isEmpty}
                onClick={() => canInteract && isEmpty && onCellClick?.(r, c)}
                title=""
                className={`w-full aspect-square flex items-center justify-center text-center p-1 transition-colors text-xs md:text-sm overflow-hidden
                  ${canInteract
                    ? 'bg-ufc-card border border-ufc-border cursor-pointer hover:border-ufc-red text-ufc-text'
                    : 'bg-ufc-card border-2 border-ufc-red cursor-not-allowed text-ufc-text'}
                `}
              >
                <span className="block w-full break-words leading-tight" />
              </button>
            )
            return <CellWrapper key={`wrap-${r}-${c}`} {...wrapperProps}>{cellContent}</CellWrapper>
          })}
        </Fragment>
      ))}
    </div>
  )
}
