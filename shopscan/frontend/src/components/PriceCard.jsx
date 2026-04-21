import { TescoLogo, DunnesLogo } from './StoreLogos'

function formatPrice(price) {
  if (price == null) return null
  return `€${Number(price).toFixed(2)}`
}

function formatComparisonValue(value, unit) {
  if (value == null || !unit) return null
  // unit is e.g. "€/L" or "€/kg" — insert value after the €
  const numStr = Number(value).toFixed(2)
  return unit.replace('€', `€${numStr}`)
}

function getBestStore(prices) {
  if (!prices) return null
  const tesco = prices.tesco?.needs_review ? null : (prices.tesco?.comparison_metric ?? prices.tesco?.price)
  const dunnes = prices.dunnes?.needs_review ? null : (prices.dunnes?.comparison_metric ?? prices.dunnes?.price)
  if (tesco == null && dunnes == null) return null
  if (tesco == null) return 'dunnes'
  if (dunnes == null) return 'tesco'
  return Number(tesco) <= Number(dunnes) ? 'tesco' : 'dunnes'
}

function PriceSkeleton() {
  return (
    <div className="space-y-2 mt-2">
      {[0, 1].map(i => (
        <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-700 p-2 animate-pulse">
          <div className="h-5 w-16 bg-slate-600 rounded-full" />
          <div className="h-5 bg-slate-600 rounded w-14" />
        </div>
      ))}
    </div>
  )
}

function getPreviousPrice(history, currentPrice) {
  if (!Array.isArray(history) || history.length < 2) return null
  const prev = history.find(h => h.price != null && h.price !== currentPrice)
  return prev?.price ?? null
}

export default function PriceCard({ prices, priceHistory, loading, onOpenStoreLink, onConfirmMatch }) {
  if (loading) return <PriceSkeleton />
  if (!prices) return null

  const best = getBestStore(prices)

  const stores = [
    { key: 'tesco',  Logo: TescoLogo,  data: prices.tesco,  history: priceHistory?.tesco },
    { key: 'dunnes', Logo: DunnesLogo, data: prices.dunnes, history: priceHistory?.dunnes },
  ]

  return (
    <div className="space-y-1.5 mt-2">
      {stores.map(({ key, Logo, data, history }) => {
        const isBest = best === key
        const price = formatPrice(data?.price)
        const detailText = data?.store_product_name || data?.price_per_unit || ''
        const normalizedText = formatComparisonValue(data?.comparison_value, data?.comparison_unit)
        const clickable = Boolean(data?.product_url)
        const needsReview = data?.needs_review
        const isConfirmed = data?.match_status === 'confirmed'
        const prevPrice = getPreviousPrice(history, data?.price)
        const prevText = prevPrice != null ? `was ${formatPrice(prevPrice)}` : null
        const priceWentDown = prevPrice != null && data?.price != null && data.price < prevPrice
        const priceWentUp   = prevPrice != null && data?.price != null && data.price > prevPrice

        const statusTone = needsReview
          ? 'text-amber-300'
          : isConfirmed
            ? 'text-green-400'
            : data?.match_status === 'size_adjusted'
              ? 'text-sky-300'
              : 'text-slate-400'

        return (
          <div key={key} className="space-y-1">
            <button
              type="button"
              onClick={() => {
                if (!clickable || !onOpenStoreLink) return
                onOpenStoreLink({
                  store: key,
                  url: data.product_url,
                  productName: data.store_product_name || detailText || null,
                  matchLabel: data.match_label || null,
                  lastRefreshAt: data.fetched_at || null,
                })
              }}
              disabled={!clickable}
              className={`grid w-full grid-cols-[auto,minmax(0,1fr),auto] items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${
                isBest ? 'bg-green-950 ring-1 ring-green-600' : 'bg-slate-700'
              } ${clickable ? 'cursor-pointer hover:bg-slate-600/90 active:scale-[0.99]' : 'cursor-default'}`}
            >
              <div className="flex h-7 w-[4.6rem] flex-shrink-0 items-center justify-center rounded-md bg-white px-1 text-slate-950">
                <Logo className={`w-auto flex-shrink-0 ${key === 'dunnes' ? 'h-2.5 sm:h-3' : 'h-3 sm:h-3.5'}`} />
              </div>

              <div className="min-w-0">
                <div className="truncate text-[11px] text-slate-300">
                  {detailText}
                </div>
                <div className={`truncate text-[10px] ${statusTone}`}>
                  {data?.match_label || (isBest && price ? 'Best option' : '')}
                </div>
              </div>

              <div className="min-w-[4.6rem] text-right">
                <span className={`block text-right text-[1.05rem] font-bold leading-none ${isBest ? 'text-green-400' : 'text-slate-100'}`}>
                  {price ?? 'N/A'}
                </span>
                {normalizedText && (
                  <span className={`block text-right text-[10px] font-medium mt-0.5 ${isBest ? 'text-green-500/80' : 'text-slate-400'}`}>
                    {normalizedText}
                  </span>
                )}
                {prevText && (
                  <span className={`block text-right text-[10px] mt-0.5 ${priceWentDown ? 'text-green-500' : priceWentUp ? 'text-amber-400' : 'text-slate-500'}`}>
                    {priceWentDown ? '↓ ' : priceWentUp ? '↑ ' : ''}{prevText}
                  </span>
                )}
              </div>
            </button>

            {/* Confirm match — only visible for needs_review rows */}
            {needsReview && onConfirmMatch && price && (
              <button
                type="button"
                onClick={() => onConfirmMatch(key)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-600 py-1 text-[10px] text-slate-400 hover:border-green-600 hover:text-green-400 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                This is the correct product — confirm match
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
