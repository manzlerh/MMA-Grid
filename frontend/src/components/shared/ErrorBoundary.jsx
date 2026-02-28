import { Component } from 'react'
import { Link } from 'react-router-dom'

/**
 * Error boundary (must be a class component). Catches render errors from children
 * and shows a fallback UI. In development, also shows error and stack.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState((s) => ({ ...s, errorInfo }))
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { error, errorInfo } = this.state
    const isDev = import.meta.env.DEV

    return (
      <div className="min-h-screen bg-ufc-dark text-ufc-text flex flex-col items-center justify-center px-4 py-12">
        <h1 className="font-display text-4xl sm:text-5xl text-ufc-gold tracking-wide text-center">
          MMA TRIVIA
        </h1>
        <p className="text-ufc-muted mt-6 text-center max-w-sm">
          Something went wrong — we&apos;re looking into it.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-lg bg-ufc-gold text-ufc-dark font-semibold hover:bg-ufc-gold/90 transition-colors"
          >
            Try Refreshing
          </button>
          <Link
            to="/"
            className="text-ufc-muted hover:text-ufc-gold text-sm transition-colors"
          >
            Go Home
          </Link>
        </div>
        {isDev && error && (
          <div className="mt-10 w-full max-w-2xl">
            <pre className="p-4 rounded bg-red-950/80 text-red-200 text-xs overflow-x-auto whitespace-pre-wrap font-mono border border-red-800">
              {error.toString()}
              {errorInfo?.componentStack != null ? `\n\n${errorInfo.componentStack}` : ''}
            </pre>
          </div>
        )}
      </div>
    )
  }
}
