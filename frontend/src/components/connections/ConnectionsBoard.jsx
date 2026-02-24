import { useMemo, useState } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'

const GROUP_COLORS = {
  yellow: 'bg-yellow-400 text-yellow-950',
  green: 'bg-green-500 text-white',
  blue: 'bg-blue-500 text-white',
  purple: 'bg-purple-600 text-white',
}

function initials(name) {
  if (!name || typeof name !== 'string') return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name[0] || '?').toUpperCase()
}

function FighterCard({ fighter, isSelected, onToggle }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = fighter?.image_url && !imageFailed

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      type="button"
      onClick={() => onToggle?.(fighter)}
      className={`
        rounded-lg px-3 py-3 text-left bg-ufc-card border border-ufc-border
        transition-all duration-200
        hover:border-ufc-gold/50
        ${isSelected ? 'ring-2 ring-white scale-95' : ''}
      `}
    >
      {/* Circular headshot above name — hidden on mobile (below sm) */}
      <div className="hidden sm:flex sm:flex-col sm:items-center mb-1">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-ufc-dark flex-shrink-0 flex items-center justify-center">
          {showImage ? (
            <img
              src={fighter.image_url}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="text-ufc-gold font-semibold text-xs">
              {initials(fighter?.name)}
            </span>
          )}
        </div>
      </div>
      <p className="font-medium text-ufc-text text-sm break-words leading-tight">
        {fighter.name}
      </p>
      {fighter.nickname ? (
        <p className="text-xs text-ufc-muted break-words leading-tight mt-0.5">
          {fighter.nickname}
        </p>
      ) : null}
    </motion.button>
  )
}

export default function ConnectionsBoard({
  fighters = [],
  selectedIds = new Set(),
  solvedGroups = [],
  onFighterToggle,
}) {
  const selectedSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds ?? [])
  const solvedFighterIds = useMemo(
    () => new Set(solvedGroups.flatMap((g) => (g.fighters ?? []).map((f) => f.id))),
    [solvedGroups]
  )
  const unsolvedFighters = useMemo(
    () => fighters.filter((f) => f && !solvedFighterIds.has(f.id)),
    [fighters, solvedFighterIds]
  )

  return (
    <LayoutGroup>
      <div className="space-y-4 w-full max-w-2xl mx-auto">
        {/* Solved groups as full-width banners — slide down from above */}
        <AnimatePresence mode="popLayout">
          {solvedGroups.map((group, idx) => (
            <motion.div
              key={group.label ?? idx}
              layout
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className={`rounded-lg px-4 py-3 ${GROUP_COLORS[group.color] ?? GROUP_COLORS.yellow}`}
            >
              <p className="font-display text-sm uppercase tracking-wide opacity-90">
                {group.label ?? 'Group'}
              </p>
              <p className="text-sm mt-1">
                {(group.fighters ?? []).map((f) => f.name).join(' · ')}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 4x4 grid of unsolved fighter cards */}
        <motion.div
          layout
          className="grid grid-cols-4 gap-2"
        >
          <AnimatePresence mode="popLayout">
            {unsolvedFighters.map((fighter) => (
              <FighterCard
                key={fighter.id}
                fighter={fighter}
                isSelected={selectedSet.has(fighter.id)}
                onToggle={onFighterToggle}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </LayoutGroup>
  )
}
