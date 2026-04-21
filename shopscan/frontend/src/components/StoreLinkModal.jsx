import { useEffect } from 'react'

export default function StoreLinkModal({ storeName, productName, url, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleOpenExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{storeName}</p>
            <h3 className="truncate text-sm font-semibold text-slate-100">
              {productName || 'Store product page'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenExternal}
              className="rounded-full bg-slate-700 px-3 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-600"
            >
              Open outside
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700"
              aria-label="Close store page"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-white">
          <iframe
            src={url}
            title={`${storeName} product page`}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 to-transparent p-3">
            <p className="text-center text-xs text-slate-200">
              If the supermarket blocks the embedded page, use “Open outside”.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
