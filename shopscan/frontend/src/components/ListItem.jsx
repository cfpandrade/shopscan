import { useEffect, useRef, useState } from 'react'
import PriceCard from './PriceCard'
import ImageModal from './ImageModal'
import StoreLinkModal from './StoreLinkModal'
import EditItemModal from './EditItemModal'

export default function ListItem({ item, onCheck, onDelete, onQuantityChange, onRefreshPrices, onForceRefresh, onPinProduct, onEditItem }) {
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const [swiping, setSwiping] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [forceRefreshing, setForceRefreshing] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState(item.image_url || item.fallback_image_url || null)
  const [storeLink, setStoreLink] = useState(null)
  const [editing, setEditing] = useState(false)
  const canSwipeToDelete = !item.checked

  useEffect(() => {
    if (item.checked) {
      setSwipeOffset(0)
      setSwiping(false)
    }
  }, [item.checked])

  useEffect(() => {
    setImageSrc(item.image_url || item.fallback_image_url || null)
  }, [item.image_url, item.fallback_image_url])

  const handleTouchStart = (e) => {
    if (!canSwipeToDelete) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setSwiping(false)
    setSwipeOffset(0)
  }

  const handleTouchMove = (e) => {
    if (!canSwipeToDelete) return
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dy > Math.abs(dx)) return
    if (dx < 0) {
      setSwiping(true)
      setSwipeOffset(Math.max(dx, -120))
    }
  }

  const handleTouchEnd = () => {
    if (!canSwipeToDelete) {
      touchStartX.current = null
      touchStartY.current = null
      setSwipeOffset(0)
      setSwiping(false)
      return
    }

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

  const handleForceRefresh = async () => {
    if (forceRefreshing || refreshing) return
    setForceRefreshing(true)
    try {
      await onForceRefresh(item.id)
    } finally {
      setForceRefreshing(false)
    }
  }

  const decrementQty = () => { if (item.quantity > 1) onQuantityChange(item.id, item.quantity - 1) }
  const incrementQty = () => { if (item.quantity < 99) onQuantityChange(item.id, item.quantity + 1) }
  const metaText = [item.brand, item.size].filter(Boolean).join(' • ')

  // Category-based placeholder emoji
  const placeholderEmoji = (() => {
    const cat = (item.category || '').toLowerCase()
    if (cat.includes('dairy') || cat.includes('milk')) return '🥛'
    if (cat.includes('meat') || cat.includes('fish')) return '🥩'
    if (cat.includes('fruit') || cat.includes('vegetable')) return '🥦'
    if (cat.includes('bread') || cat.includes('bakery')) return '🍞'
    if (cat.includes('drink') || cat.includes('beverage')) return '🥤'
    if (cat.includes('sweet') || cat.includes('chocolate')) return '🍫'
    return '🛒'
  })()

  return (
    <div className="relative overflow-hidden rounded-2xl mb-3">
      {/* Delete hint behind card */}
      {canSwipeToDelete && (
        <div
          className={`absolute inset-y-0 right-0 w-24 flex items-center justify-center bg-red-600/90 rounded-r-2xl transition-opacity ${
            swipeOffset < 0 ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        >
          <div className="rounded-2xl bg-red-500/40 p-3">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>
      )}

      {/* Card */}
      <div
        className={`relative bg-slate-800 border border-slate-700/80 rounded-2xl p-3 shadow-sm transition-transform select-none ${
          item.checked ? 'opacity-60' : ''
        }`}
        style={{ transform: `translateX(${swipeOffset}px)`, transition: swiping ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-3">
          {/* Left: image */}
          <div className="flex-shrink-0 self-center">
            {imageSrc ? (
              <button
                onClick={() => setImageOpen(true)}
                className="h-28 w-28 rounded-2xl border border-slate-600 bg-slate-700 overflow-hidden active:scale-95 transition-transform"
                aria-label="View larger image"
              >
                <img
                  src={imageSrc}
                  alt={item.name}
                  className="h-full w-full object-contain object-center"
                  onError={() => {
                    if (item.fallback_image_url && imageSrc !== item.fallback_image_url) {
                      setImageSrc(item.fallback_image_url)
                    } else {
                      setImageSrc(null)
                    }
                  }}
                />
              </button>
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-slate-600 bg-slate-700 text-4xl">
                {placeholderEmoji}
              </div>
            )}
          </div>

          {/* Right: name + quantity + prices */}
          <div className="flex min-w-0 flex-1 flex-col justify-center self-stretch">
            {/* Name row with quantity */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p className={`font-semibold text-sm leading-tight text-slate-100 ${item.checked ? 'line-through text-slate-400' : ''}`}>
                    {item.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-0.5 rounded-full bg-slate-700 p-1 text-slate-300"
                    aria-label="Edit item details"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.768-6.768a2.5 2.5 0 113.536 3.536L12.536 14.536a2 2 0 01-.878.515L8 16l.949-3.658A2 2 0 019.464 11.46z" />
                    </svg>
                  </button>
                </div>
                {metaText && (
                  <p className="text-xs text-slate-400 mt-0.5">{metaText}</p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <button
                  onClick={() => onCheck(item.id, !item.checked)}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors ${
                    item.checked ? 'bg-green-600 border-green-600' : 'border-slate-500 bg-transparent'
                  }`}
                  aria-label={item.checked ? 'Uncheck' : 'Check'}
                >
                  {item.checked && (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button onClick={decrementQty} disabled={item.quantity <= 1}
                    className="w-9 h-9 rounded-xl bg-slate-700 text-slate-300 flex items-center justify-center text-lg font-bold disabled:opacity-30 active:bg-slate-600">
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-slate-200">{item.quantity}</span>
                  <button onClick={incrementQty} disabled={item.quantity >= 99}
                    className="w-9 h-9 rounded-xl bg-slate-700 text-slate-300 flex items-center justify-center text-lg font-bold disabled:opacity-30 active:bg-slate-600">
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Prices stacked vertically */}
            <PriceCard
              prices={item.prices}
              priceHistory={item.price_history}
              loading={false}
              onOpenStoreLink={({ store, url, productName, matchLabel, lastRefreshAt }) => {
                setStoreLink({
                  storeName: store === 'tesco' ? 'Tesco' : 'Dunnes Stores',
                  url,
                  productName,
                  matchLabel,
                  lastRefreshAt,
                })
              }}
              onConfirmMatch={(store) => {
                const field = store === 'tesco' ? 'confirmed_tesco' : 'confirmed_dunnes'
                onEditItem(item.id, { [field]: true })
              }}
            />

            {/* Refresh */}
            {(() => {
              const hasNeedsReview = item.prices && Object.values(item.prices).some(p => p?.needs_review)
              const busy = refreshing || forceRefreshing
              return (
                <div className="mt-2 flex items-center justify-end gap-3">
                  {hasNeedsReview && (
                    <button onClick={handleForceRefresh} disabled={busy}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors disabled:opacity-50">
                      <svg className={`w-3 h-3 ${forceRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      {forceRefreshing ? 'Re-fetching...' : 'Force re-fetch'}
                    </button>
                  )}
                  <button onClick={handleRefresh} disabled={busy}
                    className="text-xs text-slate-400 hover:text-green-400 flex items-center gap-1 transition-colors disabled:opacity-50">
                    <svg className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {refreshing ? 'Updating...' : 'Refresh prices'}
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {imageOpen && imageSrc && (
        <ImageModal
          src={imageSrc}
          alt={item.name}
          onClose={() => setImageOpen(false)}
        />
      )}

      {storeLink && (
        <StoreLinkModal
          storeName={storeLink.storeName}
          productName={storeLink.productName}
          url={storeLink.url}
          matchLabel={storeLink.matchLabel}
          lastRefreshAt={storeLink.lastRefreshAt}
          onClose={() => setStoreLink(null)}
        />
      )}

      {editing && (
        <EditItemModal
          item={item}
          onClose={() => setEditing(false)}
          onSave={(data) => onEditItem(item.id, data)}
          onPinProduct={(store, url) => onPinProduct(item.id, store, url)}
        />
      )}
    </div>
  )
}
