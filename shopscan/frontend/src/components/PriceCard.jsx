import { TescoLogo, DunnesLogo } from './StoreLogos'

function formatPrice(price) {
  if (price == null) return null
  return `€${Number(price).toFixed(2)}`
}

function getBestStore(prices) {
  if (!prices) return null
  const tesco = prices.tesco?.price
  const dunnes = prices.dunnes?.price
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

export default function PriceCard({ prices, loading }) {
  if (loading) return <PriceSkeleton />
  if (!prices) return null

  const best = getBestStore(prices)

  const stores = [
    { key: 'tesco',  Logo: TescoLogo,  data: prices.tesco },
    { key: 'dunnes', Logo: DunnesLogo, data: prices.dunnes },
  ]

  return (
    <div className="space-y-1.5 mt-2">
      {stores.map(({ key, Logo, data }) => {
        const isBest = best === key
        const price = formatPrice(data?.price)
        const perUnit = data?.price_per_unit
        const logoWrapClass = key === 'dunnes'
          ? 'rounded-md bg-white px-2 py-1 text-slate-950'
          : ''

        return (
          <div
            key={key}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
              isBest ? 'bg-green-950 ring-1 ring-green-600' : 'bg-slate-700'
            }`}
          >
            {/* Store logo */}
            <div className={logoWrapClass}>
              <Logo className={`w-auto flex-shrink-0 ${key === 'dunnes' ? 'h-5' : 'h-7'}`} />
            </div>

            {/* Price */}
            <span className={`text-sm font-bold flex-shrink-0 ${isBest ? 'text-green-400' : 'text-slate-100'}`}>
              {price ?? 'N/A'}
            </span>

            {/* Per unit */}
            {perUnit && (
              <span className="text-xs text-slate-400 flex-1 truncate">{perUnit}</span>
            )}

            {/* Best price badge */}
            {isBest && price && (
              <span className="ml-auto text-xs text-green-500 font-medium flex-shrink-0">Best</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
