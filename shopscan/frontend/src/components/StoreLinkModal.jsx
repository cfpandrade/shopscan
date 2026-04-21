import { useEffect } from 'react'
import { TescoLogo, DunnesLogo } from './StoreLogos'

function formatDateTime(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-IE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function StoreLinkModal({ storeName, productName, url, matchLabel, lastRefreshAt, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const isTesco = storeName?.toLowerCase().includes('tesco')
  const Logo = isTesco ? TescoLogo : DunnesLogo

  const handleOpen = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Store logo */}
        <div className="flex justify-center mb-4">
          <div className="flex h-10 w-28 items-center justify-center rounded-xl bg-white px-3">
            <Logo className={`w-auto ${isTesco ? 'h-4' : 'h-3'}`} />
          </div>
        </div>

        {/* Product name */}
        <p className="text-center text-base font-semibold text-slate-100 leading-snug mb-1">
          {productName || 'Store product page'}
        </p>

        {/* Match + last refresh */}
        <p className="text-center text-xs text-slate-400 mb-5">
          {matchLabel || 'Match not assessed'} · {formatDateTime(lastRefreshAt)}
        </p>

        {/* Open button */}
        <button
          onClick={handleOpen}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-green-500 active:bg-green-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in {storeName}
        </button>

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-2xl bg-slate-800 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
