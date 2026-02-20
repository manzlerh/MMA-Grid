import { useState, useEffect, useRef, useCallback } from 'react'
import { searchFighters } from '../../services/api'

const DEBOUNCE_MS = 300

export default function FighterSearch({ onSelect, placeholder = 'Search fighters...', disabled = false, excludeNames = [] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const excludedSet = new Set(excludeNames.map((n) => n?.toLowerCase?.() ?? n))

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const { fighters } = await searchFighters(query)
        const filtered = (fighters || []).filter(
          (f) => f && !excludedSet.has((f.name || '').toLowerCase())
        )
        setResults(filtered)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, excludeNames.join(',')])

  const handleSelect = useCallback(
    (fighter) => {
      onSelect?.(fighter)
      setQuery('')
      setResults([])
      setOpen(false)
    },
    [onSelect]
  )

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-ufc-card border border-ufc-border rounded text-ufc-text placeholder-ufc-muted focus:outline-none focus:ring-1 focus:ring-ufc-gold"
      />
      {open && (query.trim() || loading) && (
        <ul
          className="absolute z-10 left-0 right-0 mt-1 py-1 bg-ufc-card border border-ufc-border rounded shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {loading && (
            <li className="px-3 py-4 text-center text-ufc-muted flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-ufc-gold border-t-transparent rounded-full animate-spin" />
              Loading...
            </li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-4 text-ufc-muted text-center">No fighters found</li>
          )}
          {!loading &&
            results.map((fighter) => (
              <li
                key={fighter.id}
                role="option"
                tabIndex={0}
                onClick={() => handleSelect(fighter)}
                onKeyDown={(e) => e.key === 'Enter' && handleSelect(fighter)}
                className="px-3 py-2 cursor-pointer hover:bg-ufc-red/20 transition-colors border-b border-ufc-border last:border-b-0"
              >
                <div className="font-medium text-ufc-text">{fighter.name}</div>
                <div className="text-sm text-ufc-muted">
                  {Array.isArray(fighter.weight_classes) ? fighter.weight_classes.join(', ') : ''}
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
