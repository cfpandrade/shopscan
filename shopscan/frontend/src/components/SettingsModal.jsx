function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return 'N/A'
  return `€${Number(value).toFixed(2)}`
}

function getItemStorePrice(item, store) {
  const rawPrice = item?.prices?.[store]?.price
  if (rawPrice == null) return null
  const price = Number(rawPrice)
  if (!Number.isFinite(price)) return null
  return price * Math.max(Number(item?.quantity) || 1, 1)
}

function buildTotals(items) {
  let tescoTotal = 0
  let dunnesTotal = 0
  let mixedTotal = 0
  let tescoCovered = 0
  let dunnesCovered = 0
  let mixedCovered = 0

  for (const item of items) {
    const tescoPrice = getItemStorePrice(item, 'tesco')
    const dunnesPrice = getItemStorePrice(item, 'dunnes')

    if (tescoPrice != null) {
      tescoTotal += tescoPrice
      tescoCovered += 1
    }

    if (dunnesPrice != null) {
      dunnesTotal += dunnesPrice
      dunnesCovered += 1
    }

    const bestPrice = [tescoPrice, dunnesPrice]
      .filter(price => price != null)
      .sort((a, b) => a - b)[0]

    if (bestPrice != null) {
      mixedTotal += bestPrice
      mixedCovered += 1
    }
  }

  const singleStoreOptions = [
    tescoCovered === items.length ? tescoTotal : null,
    dunnesCovered === items.length ? dunnesTotal : null,
  ].filter(total => total != null)

  const bestSingleStoreTotal = singleStoreOptions.length > 0
    ? Math.min(...singleStoreOptions)
    : null

  const savingsVsBestSingleStore = bestSingleStoreTotal != null && mixedCovered === items.length
    ? Math.max(bestSingleStoreTotal - mixedTotal, 0)
    : null

  return {
    tescoTotal,
    dunnesTotal,
    mixedTotal,
    tescoCovered,
    dunnesCovered,
    mixedCovered,
    itemCount: items.length,
    savingsVsBestSingleStore,
  }
}

function SummaryCard({ label, value, hint, accent = 'slate' }) {
  const accentClasses = {
    green: 'border-green-600/50 bg-green-950/40',
    blue: 'border-blue-500/40 bg-blue-950/30',
    red: 'border-red-500/40 bg-red-950/30',
    slate: 'border-slate-700 bg-slate-800/80',
  }

  return (
    <div className={`rounded-2xl border p-4 ${accentClasses[accent] || accentClasses.slate}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export default function SettingsModal({ items, onClose }) {
  const activeItems = items.filter(item => !item.checked)
  const totals = buildTotals(activeItems)
  const missingMixed = totals.itemCount - totals.mixedCovered
  const missingTesco = totals.itemCount - totals.tescoCovered
  const missingDunnes = totals.itemCount - totals.dunnesCovered

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-[1.75rem] border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Shopping summary</h2>
            <p className="text-sm text-slate-400">
              {totals.itemCount} active item{totals.itemCount !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700"
            aria-label="Close settings"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <SummaryCard
            label="Best Total"
            value={formatPrice(totals.mixedCovered === totals.itemCount ? totals.mixedTotal : null)}
            hint={
              missingMixed > 0
                ? `Missing prices for ${missingMixed} item${missingMixed !== 1 ? 's' : ''}`
                : 'Buying each item where it is cheapest'
            }
            accent="green"
          />

          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              label="Tesco Total"
              value={formatPrice(totals.tescoCovered === totals.itemCount ? totals.tescoTotal : null)}
              hint={
                missingTesco > 0
                  ? `Missing ${missingTesco} item${missingTesco !== 1 ? 's' : ''}`
                  : 'Buying everything in Tesco'
              }
              accent="blue"
            />
            <SummaryCard
              label="Dunnes Total"
              value={formatPrice(totals.dunnesCovered === totals.itemCount ? totals.dunnesTotal : null)}
              hint={
                missingDunnes > 0
                  ? `Missing ${missingDunnes} item${missingDunnes !== 1 ? 's' : ''}`
                  : 'Buying everything in Dunnes'
              }
              accent="red"
            />
          </div>

          <SummaryCard
            label="Savings With Both"
            value={formatPrice(totals.savingsVsBestSingleStore)}
            hint={
              totals.savingsVsBestSingleStore == null
                ? 'Need full prices in at least one supermarket and in the mixed basket'
                : 'How much you save versus the cheapest single-supermarket option'
            }
          />

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
            Totals use the current list prices multiplied by quantity. Checked items are excluded so the summary reflects what is left to buy.
          </div>
        </div>
      </div>
    </div>
  )
}
