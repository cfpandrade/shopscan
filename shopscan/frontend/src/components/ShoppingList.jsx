import { useState, useRef } from 'react'
import useShoppingList from '../hooks/useShoppingList'
import ListItem from './ListItem'
import AddItemModal from './AddItemModal'

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

function getBestStore(prices) {
  if (!prices) return null
  const t = prices.tesco?.price
  const d = prices.dunnes?.price
  if (t == null && d == null) return null
  if (t == null) return 'dunnes'
  if (d == null) return 'tesco'
  return Number(t) <= Number(d) ? 'tesco' : 'dunnes'
}

const FILTERS = [
  { id: 'all',    label: 'All',    icon: '🛒' },
  { id: 'tesco',  label: 'Tesco',  icon: '🔵' },
  { id: 'dunnes', label: 'Dunnes', icon: '🔴' },
]

export default function ShoppingList() {
  const { items, loading, error, addItem, updateItem, deleteItem, checkItem, clearChecked, refreshPrices, refetch } = useShoppingList()
  const [addOpen, setAddOpen] = useState(false)
  const [storeFilter, setStoreFilter] = useState('all')

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

  // Apply store filter to unchecked items only
  const filteredUnchecked = storeFilter === 'all'
    ? unchecked
    : unchecked.filter(item => getBestStore(item.prices) === storeFilter)

  const filterCount = storeFilter !== 'all' ? filteredUnchecked.length : unchecked.length

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
            {pullRefreshing && (
              <svg className="w-4 h-4 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
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
          </div>
        </div>

        {/* Store filter pills */}
        <div className="flex gap-2 mt-3">
          {FILTERS.map(f => {
            const isActive = storeFilter === f.id
            // Count items for this filter
            const count = f.id === 'all'
              ? unchecked.length
              : unchecked.filter(i => getBestStore(i.prices) === f.id).length
            return (
              <button
                key={f.id}
                onClick={() => setStoreFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? f.id === 'tesco'  ? 'bg-blue-700 text-white'
                    : f.id === 'dunnes' ? 'bg-red-700 text-white'
                    : 'bg-green-700 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
                {count > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                    isActive ? 'bg-white/20' : 'bg-slate-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Filter info bar */}
        {storeFilter !== 'all' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <span>
              {filteredUnchecked.length === 0
                ? `No items cheaper at ${storeFilter === 'tesco' ? 'Tesco' : 'Dunnes'} — try refreshing prices`
                : `${filteredUnchecked.length} item${filteredUnchecked.length !== 1 ? 's' : ''} cheapest at ${storeFilter === 'tesco' ? 'Tesco' : 'Dunnes'}`
              }
            </span>
            {unchecked.length - filteredUnchecked.length > 0 && (
              <span className="text-slate-500">
                ({unchecked.length - filteredUnchecked.length} hidden)
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
            {filteredUnchecked.length === 0 && storeFilter !== 'all' ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                <span className="text-4xl mb-3">{storeFilter === 'tesco' ? '🔵' : '🔴'}</span>
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
              filteredUnchecked.map(item => (
                <ListItem key={item.id} item={item}
                  onCheck={checkItem} onDelete={deleteItem}
                  onQuantityChange={(id, qty) => updateItem(id, { quantity: qty })}
                  onRefreshPrices={refreshPrices} />
              ))
            )}

            {checked.length > 0 && storeFilter === 'all' && (
              <>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Checked ({checked.length})
                  </span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>
                {checked.map(item => (
                  <ListItem key={item.id} item={item}
                    onCheck={checkItem} onDelete={deleteItem}
                    onQuantityChange={(id, qty) => updateItem(id, { quantity: qty })}
                    onRefreshPrices={refreshPrices} />
                ))}
              </>
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
    </div>
  )
}
