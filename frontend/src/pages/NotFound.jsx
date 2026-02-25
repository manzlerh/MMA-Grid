import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ufc-dark text-ufc-text flex flex-col items-center justify-center px-4">
      <h1 className="font-display text-4xl sm:text-5xl text-ufc-gold tracking-wide text-center">
        404 — PAGE NOT FOUND
      </h1>
      <p className="text-ufc-muted mt-4 text-center">
        This page doesn&apos;t exist.
      </p>
      <Link
        to="/"
        className="mt-8 px-5 py-2.5 rounded-lg bg-ufc-gold text-ufc-dark font-semibold hover:bg-ufc-gold/90 transition-colors"
      >
        Go Home
      </Link>
    </div>
  )
}
