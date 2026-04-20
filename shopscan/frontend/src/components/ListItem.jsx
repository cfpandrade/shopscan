import { useRef, useState } from 'react'
import PriceCard from './PriceCard'

export default function ListItem({ item, onCheck, onDelete, onQuantityChange, onRefreshPrices }) {
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const [swiping, setSwiping] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setSwiping(false)
    setSwipeOffset(0)
  }

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    // Only track horizontal swipe if more horizontal than vertical
    if (dy > Math.abs(dx)) return
    if (dx < 0) {
      setSwiping(true)
      setSwipeOffset(Math.max(dx, -120))
    }
  }

  const handleTouchEnd = () => {
    if (swipeOffset < -80) {
      setSwipeOffset(-120)
      if (window.confirm(`Remove "${item.name}" from list?`)) {
        onDelete(item.id)
      } else {
        setSwipeOffset(0)
        setSwiping(false)
      }
    } else {
      setSwipeOffset(0)
      setSwiping(false)
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefreshPrices(item.id)
    } finally {
      setRefreshing(false)
    }
  }

  const decrementQty = () => {
    if (item.quantity > 1) onQuantityChange(item.id, item.quantity - 1)
  }

  const incrementQty = () => {
    if (item.quantity < 99) onQuantityChange(item.id, item.quantity + 1)
  }

  return (
    <div className="relative overflow-hidden rounded-xl mb-2">
      {/* Delete hint behind card */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-red-600 rounded-xl">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>

      {/* Card content */}
      <div
        className={`relative bg-slate-800 rounded-xl p-3 transition-transform select-none ${item.checked ? 'opacity-50' : ''}`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={() => onCheck(item.id, !item.checked)}
            className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 ${
              item.checked
                ? 'bg-green-600 border-green-600'
                : 'border-slate-500 bg-transparent'
            }`}
            aria-label={item.checked ? 'Uncheck item' : 'Check item'}
          >
            {item.checked && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Product image (if available) */}
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-10 h-10 rounded-lg object-contain bg-slate-700 flex-shrink-0"
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          )}

          {/* Name + brand */}
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm leading-tight text-slate-100 ${item.checked ? 'line-through text-slate-400' : ''}`}>
              {item.name}
            </p>
            {item.brand && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{item.brand}</p>
            )}
            {item.notes && (
              <p className="text-xs text-slate-500 mt-0.5 italic truncate">{item.notes}</p>
            )}
          </div>

          {/* Quantity controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={decrementQty}
              disabled={item.quantity <= 1}
              className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center text-lg font-bold disabled:opacity-30 active:bg-slate-600 transition-colors"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-medium text-slate-200">
              {item.quantity}
            </span>
            <button
              onClick={incrementQty}
              disabled={item.quantity >= 99}
              className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center text-lg font-bold disabled:opacity-30 active:bg-slate-600 transition-colors"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        {/* Price section */}
        <div className="mt-1">
          <PriceCard prices={item.prices} loading={false} />
        </div>

        {/* Refresh prices button */}
        {item.prices !== undefined && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs text-slate-400 hover:text-green-400 active:text-green-500 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh prices'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
