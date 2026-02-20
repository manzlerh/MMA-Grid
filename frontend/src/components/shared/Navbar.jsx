import { NavLink } from 'react-router-dom'

export default function Navbar() {
  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-colors ${
      isActive
        ? 'bg-ufc-gold text-ufc-dark'
        : 'text-ufc-text hover:bg-ufc-red/20 border border-ufc-border'
    }`

  return (
    <header className="bg-ufc-card border-b border-ufc-border">
      <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <NavLink to="/" className="font-display text-2xl text-ufc-gold tracking-wide">
          UFC TRIVIA
        </NavLink>
        <div className="flex gap-2">
          <NavLink to="/grid" className={linkClass}>
            GRID
          </NavLink>
          <NavLink to="/connections" className={linkClass}>
            CONNECTIONS
          </NavLink>
        </div>
      </nav>
    </header>
  )
}
