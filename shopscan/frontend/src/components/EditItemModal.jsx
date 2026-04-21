import { useState } from 'react'

export default function EditItemModal({ item, onClose, onSave }) {
  const [name, setName] = useState(item.name || '')
  const [brand, setBrand] = useState(item.brand || '')
  const [size, setSize] = useState(item.size || '')
  const [description, setDescription] = useState(item.description || '')
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[1.5rem] border border-slate-700 bg-slate-900 p-4 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Edit item</h3>
            <p className="text-sm text-slate-400">Fix name, brand, size or description for better price matching.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Brand</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Size</span>
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 1kg or 500g" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
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
      </form>
    </div>
  )
}
