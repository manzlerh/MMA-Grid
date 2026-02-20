import { Modal, FighterSearch } from '../shared'

export default function CellModal({
  isOpen,
  onClose,
  rowLabel,
  colLabel,
  onFighterSelect,
  excludeNames = [],
}) {
  const handleSelect = (fighter) => {
    onFighterSelect?.(fighter)
    onClose?.()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={null}>
      <div className="space-y-4">
        <p className="text-ufc-text text-sm">Find a fighter who:</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-ufc-red/20 text-ufc-red border border-ufc-red/50 text-sm font-medium">
            {rowLabel ?? ''}
          </span>
          <span className="text-ufc-muted text-sm">AND</span>
          <span className="px-3 py-1 rounded-full bg-ufc-gold/20 text-ufc-gold border border-ufc-gold/50 text-sm font-medium">
            {colLabel ?? ''}
          </span>
        </div>
        <FighterSearch
          onSelect={handleSelect}
          placeholder="Search fighters..."
          excludeNames={excludeNames}
        />
      </div>
    </Modal>
  )
}
