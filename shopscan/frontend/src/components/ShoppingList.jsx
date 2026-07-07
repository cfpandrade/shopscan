import { useState, useRef } from 'react'
import useShoppingList from '../hooks/useShoppingList'
import ListItem from './ListItem'
import AddItemModal from './AddItemModal'
import SettingsModal from './SettingsModal'
import { TescoLogo, DunnesLogo } from './StoreLogos'
import { getBestStore } from '../utils/prices'

function SkeletonCard() {
  return (
    <div className="bg-slate-800 rounded-xl p-3 mb-2 animate-pulse">
      <div className="flex gap-3">
        <div className="w-20 h-20 rounded-xl bg-slate-700 flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-slate-700 rounded w-3/4" />
          <div className="h-3 bg-slate-700 rounded w-1/2" />
          <div className="h-8 bg-slate-700 rounded mt-3" />
          <div className="h-8 bg-slate-700 rounded" />
        </div>
      </div>
    </div>
  )
}


const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'tesco', label: 'Tesco', Logo: TescoLogo },
  { id: 'dunnes', label: 'Dunnes', Logo: DunnesLogo },
]

function fmt(price) {
  return price != null ? `€${Number(price).toFixed(2)}` : null
}

function generateShareText(items) {
  const active = items.filter(i => !i.checked)
  if (active.length === 0) return 'ShopScan IE — list is empty'

  const tesco  = active.filter(i => getBestStore(i.prices) === 'tesco')
  const dunnes = active.filter(i => getBestStore(i.prices) === 'dunnes')
  const noprice = active.filter(i => getBestStore(i.prices) === null)

  const lines = ['🛒 ShopScan IE', '']
  const fmtItem = (item, store) => {
    const p = item.prices?.[store]
    const price = fmt(p?.price)
    const qty = item.quantity > 1 ? ` ×${item.quantity}` : ''
    return `  • ${item.name}${qty}${price ? ` — ${price}` : ''}`
  }
  if (tesco.length > 0) {
    lines.push('🔵 Tesco')
    tesco.forEach(i => lines.push(fmtItem(i, 'tesco')))
    lines.push('')
  }
  if (dunnes.length > 0) {
    lines.push('🟢 Dunnes Stores')
    dunnes.forEach(i => lines.push(fmtItem(i, 'dunnes')))
    lines.push('')
  }
  if (noprice.length > 0) {
    lines.push('❓ No price yet')
    noprice.forEach(i => {
      const qty = i.quantity > 1 ? ` ×${i.quantity}` : ''
      lines.push(`  • ${i.name}${qty}`)
    })
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

export default function ShoppingList() {
  const { items, loading, error, addItem, updateItem, deleteItem, checkItem, clearChecked, refreshPrices, forceRefreshItem, pinProduct, refreshAllPrices, refreshStatus, refetch } = useShoppingList()
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [storeFilter, setStoreFilter] = useState('all')
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const touchStartY = useRef(null)
  const listRef = useRef(null)
  const [pullRefreshing, setPullRefreshing] = useState(false)

  const handleListTouchStart = (e) => {
    if (listRef.current?.scrollTop === 0) touchStartY.current = e.touches[0].clientY
    else touchStartY.current = null
  }

  const handleListTouchEnd = async (e) => {
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (dy > 60 && !pullRefreshing) {
      setPullRefreshing(true)
      try { await refetch() } finally { setPullRefreshing(false) }
    }
    touchStartY.current = null
  }

  const unchecked = items.filter(i => !i.checked)
  const checked   = items.filter(i => i.checked)

  const visibleItems = storeFilter === 'all'
    ? items
    : items.filter(item => getBestStore(item.prices) === storeFilter)

  const handleShare = async () => {
    const text = generateShareText(items)
    if (navigator.share) {
      try { await navigator.share({ title: 'ShopScan IE', text }) } catch {}
    } else {
      await navigator.clipboard.writeText(text)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  const handleClearAll = () => {
    if (items.length === 0) return
    if (window.confirm(`Remove all ${items.length} item${items.length !== 1 ? 's' : ''} from the list?`)) {
      items.forEach(i => deleteItem(i.id))
    }
  }

  const handleRefreshAllPrices = async () => {
    if (refreshingAll || unchecked.length === 0) return
    setRefreshingAll(true)
    try {
      await refreshAllPrices()
    } finally {
      setRefreshingAll(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-900 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h1 className="text-lg font-bold text-slate-100 truncate">ShopScan IE</h1>
            {unchecked.length > 0 && (
              <span className="flex-shrink-0 bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unchecked.length > 99 ? '99+' : unchecked.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Share */}
            {items.length > 0 && (
              <button
                onClick={handleShare}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-300 transition-colors hover:bg-slate-600 hover:text-slate-100"
                aria-label="Share list"
              >
                {shareCopied ? (
                  <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
              </button>
            )}

            {/* Summary */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-300 transition-colors hover:bg-slate-600 hover:text-slate-100"
              aria-label="Open shopping summary"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l.235.724a1 1 0 00.95.69h.761c.969 0 1.371 1.24.588 1.81l-.615.447a1 1 0 00-.364 1.118l.235.724c.3.921-.755 1.688-1.539 1.118l-.615-.447a1 1 0 00-1.176 0l-.615.447c-.783.57-1.838-.197-1.539-1.118l.235-.724a1 1 0 00-.364-1.118l-.615-.447c-.783-.57-.38-1.81.588-1.81h.761a1 1 0 00.95-.69l.235-.724zM12 15a3 3 0 100 6 3 3 0 000-6z" />
              </svg>
            </button>

            {pullRefreshing && (
              <svg className="w-4 h-4 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}

            {/* Clear checked */}
            {checked.length > 0 && (
              <button
                onClick={() => { if (window.confirm(`Remove ${checked.length} checked item${checked.length !== 1 ? 's' : ''}?`)) clearChecked() }}
                className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-red-900 hover:text-red-400 transition-colors"
                aria-label="Clear checked items"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}

            {/* Clear all */}
            {items.length > 0 && checked.length === 0 && (
              <button
                onClick={handleClearAll}
                className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-red-900 hover:text-red-400 transition-colors"
                aria-label="Clear all items"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Store filter pills */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(f => {
            const isActive = storeFilter === f.id
            const isAll = f.id === 'all'
            const Logo = f.Logo
            // Count items for this filter
            const count = f.id === 'all'
              ? items.length
              : items.filter(i => getBestStore(i.prices) === f.id).length
            return (
              <button
                key={f.id}
                onClick={() => setStoreFilter(f.id)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? isAll
                      ? 'bg-green-700 text-white border-green-500'
                      : 'bg-slate-100 text-slate-950 border-slate-200 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                }`}
              >
                {isAll ? (
                  <>
                    <span className={`text-base ${isActive ? '' : 'opacity-90'}`}>🛒</span>
                    <span>{f.label}</span>
                  </>
                ) : (
                  <div className={`flex h-7 w-[4.6rem] items-center justify-center rounded-md px-1 ${isActive ? 'bg-white text-slate-950' : 'bg-white text-slate-950/90'}`}>
                    <Logo className={`w-auto ${f.id === 'dunnes' ? 'h-2.5' : 'h-3'}`} />
                  </div>
                )}
                {count > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                    isActive
                      ? isAll
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-900/10 text-slate-900'
                      : 'bg-slate-700 text-slate-200'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {unchecked.length > 0 && (
          <div className="mt-3">
            <button
              onClick={handleRefreshAllPrices}
              disabled={refreshingAll}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${refreshingAll ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshingAll
                ? `Refreshing ${refreshStatus?.current_store || 'prices'}${refreshStatus?.current_item_name ? `: ${refreshStatus.current_item_name}` : ''} (${refreshStatus?.completed_items || 0}/${refreshStatus?.total_items || 0})`
                : 'Refresh all prices'}
            </button>
          </div>
        )}

        {/* Filter info bar */}
        {storeFilter !== 'all' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <span>
              {visibleItems.length === 0
                ? `No items cheaper at ${storeFilter === 'tesco' ? 'Tesco' : 'Dunnes'} — try refreshing prices`
                : `${visibleItems.length} item${visibleItems.length !== 1 ? 's' : ''} cheapest at ${storeFilter === 'tesco' ? 'Tesco' : 'Dunnes'}`
              }
            </span>
            {items.length - visibleItems.length > 0 && (
              <span className="text-slate-500">
                ({items.length - visibleItems.length} hidden)
              </span>
            )}
          </div>
        )}
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 px-4 py-2 text-sm text-red-300 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
          <button onClick={refetch} className="ml-auto text-red-200 underline text-xs">Retry</button>
        </div>
      )}

      {/* Main list */}
      <main ref={listRef} className="flex-1 overflow-y-auto px-3 py-3"
        onTouchStart={handleListTouchStart} onTouchEnd={handleListTouchEnd}>

        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-8">
            <span className="text-6xl mb-4">🛒</span>
            <p className="text-xl font-semibold text-slate-300 mb-2">Your list is empty</p>
            <p className="text-sm text-slate-500">Tap + to add items</p>
          </div>
        ) : (
          <>
            {visibleItems.length === 0 && storeFilter !== 'all' ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                <div className="mb-3 rounded-xl bg-white px-3 py-2 text-slate-950 shadow-sm">
                  {storeFilter === 'tesco'
                    ? <TescoLogo className="h-7 w-auto" />
                    : <DunnesLogo className="h-5 w-auto" />
                  }
                </div>
                <p className="text-slate-400 text-sm">
                  No items are cheapest at {storeFilter === 'tesco' ? 'Tesco' : 'Dunnes Stores'} yet.
                </p>
                <p className="text-slate-500 text-xs mt-1">Try refreshing prices on your items first.</p>
                <button onClick={() => setStoreFilter('all')}
                  className="mt-4 text-xs text-green-400 underline">
                  Show all items
                </button>
              </div>
            ) : (
              visibleItems.map(item => (
                <ListItem key={item.id} item={item}
                  onCheck={checkItem} onDelete={deleteItem}
                  onQuantityChange={(id, qty) => updateItem(id, { quantity: qty })}
                  onRefreshPrices={refreshPrices}
                  onForceRefresh={forceRefreshItem}
                  onPinProduct={pinProduct}
                  onEditItem={updateItem} />
              ))
            )}

            <div className="h-20" />
          </>
        )}
      </main>

      {/* FAB */}
      <button onClick={() => setAddOpen(true)}
        className="fixed bottom-6 right-5 w-14 h-14 rounded-full bg-green-600 text-white shadow-lg shadow-green-900/50 flex items-center justify-center hover:bg-green-500 active:bg-green-700 transition-colors z-30"
        aria-label="Add item">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {addOpen && (
        <AddItemModal
          onClose={() => setAddOpen(false)}
          onAdd={async (data) => { await addItem(data); setAddOpen(false) }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          items={items}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
