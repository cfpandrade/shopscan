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
    <div className="flex gap-2 mt-2">
      {[0, 1].map(i => (
        <div key={i} className="flex-1 rounded-lg bg-slate-700 p-2 animate-pulse">
          <div className="h-4 bg-slate-600 rounded w-14 mb-1" />
          <div className="h-5 bg-slate-600 rounded w-10 mb-1" />
          <div className="h-3 bg-slate-600 rounded w-16" />
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
    {
      key: 'tesco',
      Logo: TescoLogo,
      data: prices.tesco
    },
    {
      key: 'dunnes',
      Logo: DunnesLogo,
      data: prices.dunnes
    }
  ]

  return (
    <div className="flex gap-2 mt-2">
      {stores.map(({ key, Logo, data }) => {
        const isBest = best === key
        const price = formatPrice(data?.price)
        const perUnit = data?.price_per_unit
        const hasError = data?.error

        return (
          <div
            key={key}
            className={`flex-1 rounded-lg p-2 bg-slate-700 transition-all ${isBest ? 'price-best' : ''}`}
          >
            <Logo className="h-5 w-auto mb-1" />
            {hasError ? (
              <p className="text-xs text-slate-400">Unavailable</p>
            ) : price ? (
              <>
                <p className={`text-sm font-bold ${isBest ? 'text-green-400' : 'text-slate-100'}`}>
                  {price}
                </p>
                {perUnit && (
                  <p className="text-xs text-slate-400 leading-tight">{perUnit}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">N/A</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
