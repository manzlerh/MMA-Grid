import { useMemo } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'

const GROUP_COLORS = {
  yellow: 'bg-yellow-400 text-yellow-950',
  green: 'bg-green-500 text-white',
  blue: 'bg-blue-500 text-white',
  purple: 'bg-purple-600 text-white',
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
        {/* Solved groups as full-width banners */}
        <AnimatePresence mode="popLayout">
          {solvedGroups.map((group, idx) => (
            <motion.div
              key={group.label ?? idx}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
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
            {unsolvedFighters.map((fighter) => {
              const isSelected = selectedSet.has(fighter.id)
              return (
                <motion.button
                  key={fighter.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  type="button"
                  onClick={() => onFighterToggle?.(fighter)}
                  className={`
                    rounded-lg px-3 py-3 text-left bg-ufc-card border border-ufc-border
                    transition-all duration-200
                    hover:border-ufc-gold/50
                    ${isSelected ? 'ring-2 ring-white scale-95' : ''}
                  `}
                >
                  <p className="font-medium text-ufc-text text-sm truncate">
                    {fighter.name}
                  </p>
                  {fighter.nickname ? (
                    <p className="text-xs text-ufc-muted truncate mt-0.5">
                      {fighter.nickname}
                    </p>
                  ) : null}
                </motion.button>
              )
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </LayoutGroup>
  )
}
