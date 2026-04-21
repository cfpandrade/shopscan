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
        const detailText = data?.store_product_name || data?.price_per_unit || ''

        return (
          <div
            key={key}
            className={`grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-2 rounded-lg px-2.5 py-2 transition-all ${
              isBest ? 'bg-green-950 ring-1 ring-green-600' : 'bg-slate-700'
            }`}
          >
            <div className="flex h-7 w-[4.6rem] flex-shrink-0 items-center justify-center rounded-md bg-white px-1 text-slate-950">
              <Logo className={`w-auto flex-shrink-0 ${key === 'dunnes' ? 'h-2.5 sm:h-3' : 'h-3 sm:h-3.5'}`} />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[11px] text-slate-300">
                {detailText}
              </div>
              {isBest && price && (
                <div className="hidden text-[10px] font-medium uppercase tracking-wide text-green-400 sm:block">
                  Best option
                </div>
              )}
            </div>

            <div className="min-w-[4.6rem] text-right">
              <span className={`block text-right text-[1.05rem] font-bold leading-none ${isBest ? 'text-green-400' : 'text-slate-100'}`}>
                {price ?? 'N/A'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
