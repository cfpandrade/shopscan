import { useState } from 'react'

export default function EditItemModal({ item, onClose, onSave, onPinProduct }) {
  const [name, setName] = useState(item.name || '')
  const [brand, setBrand] = useState(item.brand || '')
  const [size, setSize] = useState(item.size || '')
  const [description, setDescription] = useState(item.description || '')
  const [tescoUrl, setTescoUrl] = useState(item.custom_tesco_url || '')
  const [dunnesUrl, setDunnesUrl] = useState(item.custom_dunnes_url || '')
  const [saving, setSaving] = useState(false)
  const [pinningStore, setPinningStore] = useState(null)
  const [pinError, setPinError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        custom_name: name.trim() || null,
        custom_brand: brand.trim() || null,
        custom_size: size.trim() || null,
        custom_description: description.trim() || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handlePin = async (store) => {
    const url = store === 'tesco' ? tescoUrl.trim() : dunnesUrl.trim()
    if (!url) return
    setPinError(null)
    setPinningStore(store)
    try {
      await onPinProduct(store, url)
      onClose()
    } catch (err) {
      setPinError(err?.response?.data?.error || err.message || 'Failed to pin product')
    } finally {
      setPinningStore(null)
    }
  }

  const urlInputClass = 'w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 text-sm placeholder:text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[1.5rem] border border-slate-700 bg-slate-900 p-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Edit item</h3>
            <p className="text-sm text-slate-400">Fix details or pin the exact store product.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Product details */}
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={urlInputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Brand</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className={urlInputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Size</span>
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 1kg or 500g" className={urlInputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={urlInputClass} />
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-slate-700 px-4 py-3 text-sm font-medium text-slate-100">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Store URL pinning */}
        <div className="mt-5 border-t border-slate-800 pt-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Pin exact product</p>
          <p className="text-xs text-slate-500 mb-3">
            Paste the URL of the correct product from Tesco or Dunnes and tap "Use this" to lock prices to that specific product.
          </p>

          {pinError && (
            <p className="text-xs text-red-400 mb-3">{pinError}</p>
          )}

          {/* Tesco URL */}
          <div className="mb-3">
            <span className="mb-1 block text-xs text-slate-400">Tesco product URL</span>
            <div className="flex gap-2">
              <input
                value={tescoUrl}
                onChange={(e) => setTescoUrl(e.target.value)}
                placeholder="https://www.tesco.ie/groceries/..."
                className={`flex-1 ${urlInputClass}`}
              />
              <button
                type="button"
                onClick={() => handlePin('tesco')}
                disabled={!tescoUrl.trim() || pinningStore !== null}
                className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40 hover:bg-slate-600 transition-colors whitespace-nowrap"
              >
                {pinningStore === 'tesco' ? '...' : 'Use this'}
              </button>
            </div>
          </div>

          {/* Dunnes URL */}
          <div>
            <span className="mb-1 block text-xs text-slate-400">Dunnes product URL</span>
            <div className="flex gap-2">
              <input
                value={dunnesUrl}
                onChange={(e) => setDunnesUrl(e.target.value)}
                placeholder="https://www.dunnesstoresgrocery.com/..."
                className={`flex-1 ${urlInputClass}`}
              />
              <button
                type="button"
                onClick={() => handlePin('dunnes')}
                disabled={!dunnesUrl.trim() || pinningStore !== null}
                className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40 hover:bg-slate-600 transition-colors whitespace-nowrap"
              >
                {pinningStore === 'dunnes' ? '...' : 'Use this'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
