import { useEffect } from 'react'
import { Dialog } from '@headlessui/react'

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  return (
    <Dialog open={isOpen} onClose={onClose} transition={false} static className="relative z-50">
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={onClose}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md">
              <Dialog.Panel
                className="relative bg-ufc-card border border-ufc-border rounded-lg shadow-xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 rounded text-ufc-muted hover:text-ufc-text hover:bg-ufc-border transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {title && (
                  <Dialog.Title className="text-lg font-semibold text-ufc-text pr-8 mb-4">
                    {title}
                  </Dialog.Title>
                )}
                {children}
              </Dialog.Panel>
            </div>
          </div>
        </>
      )}
    </Dialog>
  )
}
