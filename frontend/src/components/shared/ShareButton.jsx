import { useState } from 'react'

export default function ShareButton({ resultText }) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    if (!resultText) return
    try {
      await navigator.clipboard.writeText(resultText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (_) {}
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!resultText}
      className="px-4 py-2 rounded-lg border-2 border-ufc-gold text-ufc-gold bg-transparent hover:bg-ufc-gold/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
