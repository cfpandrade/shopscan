import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/client'
import BarcodeScanner from './BarcodeScanner'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function AddItemModal({ onClose, onAdd }) {
  const [tab, setTab] = useState('scan')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  // For scanned barcode
  const [scannedBarcode, setScannedBarcode] = useState(null)
  const [barcodeProduct, setBarcodeProduct] = useState(null)
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [customName, setCustomName] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const debouncedQuery = useDebounce(query, 300)

  // Search products
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    let cancelled = false
    setSearchLoading(true)
    api.get('/products/search', { params: { q: debouncedQuery } })
      .then(res => {
        if (!cancelled) {
          setSearchResults(res.data || [])
          setShowDropdown(true)
        }
      })
      .catch(() => {
        if (!cancelled) setSearchResults([])
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false)
      })
    return () => { cancelled = true }
  }, [debouncedQuery])

  // Fetch product by barcode
  const handleBarcodeScan = useCallback(async (barcode) => {
    setScannedBarcode(barcode)
    setBarcodeLoading(true)
    setBarcodeProduct(null)
    setError(null)
    try {
      const res = await api.get(`/products/barcode/${barcode}`)
      setBarcodeProduct(res.data)
    } catch (err) {
      if (err.response?.status === 404) {
        setBarcodeProduct(null)
      } else {
        setError('Failed to look up barcode')
      }
    } finally {
      setBarcodeLoading(false)
    }
  }, [])

  const handleAddBarcode = async () => {
    if (!scannedBarcode) return
    setAdding(true)
    setError(null)
    try {
      await onAdd({ barcode: scannedBarcode, quantity })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add item')
    } finally {
      setAdding(false)
    }
  }

  const handleAddManual = async () => {
    const name = selectedProduct ? selectedProduct.name : customName.trim()
    if (!name) return
    setAdding(true)
    setError(null)
    try {
      if (selectedProduct?.barcode) {
        await onAdd({ barcode: selectedProduct.barcode, quantity })
      } else {
        await onAdd({ custom_name: name, quantity })
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add item')
    } finally {
      setAdding(false)
    }
  }

  const handleSelectProduct = (product) => {
    setSelectedProduct(product)
    setQuery(product.name)
    setShowDropdown(false)
  }

  const handleQueryChange = (e) => {
    setQuery(e.target.value)
    setSelectedProduct(null)
    setCustomName(e.target.value)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const resetScan = () => {
    setScannedBarcode(null)
    setBarcodeProduct(null)
    setQuantity(1)
    setError(null)
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 bg-slate-900 sticky top-0 z-10 border-b border-slate-700">
            <h2 className="text-lg font-bold text-slate-100">Add Item</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-600 active:bg-slate-500 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700 bg-slate-900">
            {['scan', 'manual'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); resetScan() }}
                className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
                  tab === t
                    ? 'text-green-400 border-b-2 border-green-500'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'scan' ? 'Scan Barcode' : 'Manual Search'}
              </button>
            ))}
          </div>

          <div className="flex-1 px-4 py-5 bg-slate-900">
            {/* Scan Tab */}
            {tab === 'scan' && (
              <div className="flex flex-col items-center gap-4">
                {!scannedBarcode ? (
                  <BarcodeScanner
                    onResult={handleBarcodeScan}
                    onClose={onClose}
                  />
                ) : (
                  <div className="w-full max-w-sm">
                    {barcodeLoading ? (
                      <div className="space-y-3 animate-pulse">
                        <div className="h-5 bg-slate-700 rounded w-3/4" />
                        <div className="h-4 bg-slate-700 rounded w-1/2" />
                        <div className="h-24 bg-slate-700 rounded-xl" />
                      </div>
                    ) : (
                      <>
                        <div className="bg-slate-800 rounded-xl p-4 mb-4">
                          <p className="text-xs text-slate-400 mb-1">Barcode: {scannedBarcode}</p>
                          {barcodeProduct ? (
                            <div className="flex gap-3 items-start">
                              {barcodeProduct.image_url && (
                                <img
                                  src={barcodeProduct.image_url}
                                  alt={barcodeProduct.name}
                                  className="w-16 h-16 rounded-lg object-contain bg-slate-700"
                                />
                              )}
                              <div>
                                <p className="font-semibold text-slate-100">{barcodeProduct.name}</p>
                                {barcodeProduct.brand && (
                                  <p className="text-sm text-slate-400">{barcodeProduct.brand}</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-300 text-sm">Product not found — will be added as unknown barcode.</p>
                          )}
                        </div>

                        <QuantitySelector quantity={quantity} setQuantity={setQuantity} />

                        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={resetScan}
                            className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-semibold hover:bg-slate-600 active:bg-slate-500 transition-colors"
                          >
                            Scan Again
                          </button>
                          <button
                            onClick={handleAddBarcode}
                            disabled={adding}
                            className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 active:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {adding ? 'Adding...' : 'Add to List'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Manual Tab */}
            {tab === 'manual' && (
              <div className="w-full max-w-sm mx-auto space-y-4">
                <div className="relative" ref={dropdownRef}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Search or enter product name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={query}
                      onChange={handleQueryChange}
                      placeholder="e.g. Avonmore Milk 2L"
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 pr-10 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                      autoFocus
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Dropdown results */}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {searchResults.map((product, idx) => (
                        <button
                          key={product.id || product.barcode || idx}
                          onClick={() => handleSelectProduct(product)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-700 active:bg-slate-600 transition-colors border-b border-slate-700 last:border-0"
                        >
                          <p className="text-sm font-medium text-slate-100 truncate">{product.name}</p>
                          {product.brand && (
                            <p className="text-xs text-slate-400 truncate">{product.brand}</p>
                          )}
                          {(product.description || product.barcode) && (
                            <p className="text-xs text-slate-500 truncate">
                              {[product.description, product.barcode].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {showDropdown && searchResults.length === 0 && !searchLoading && debouncedQuery.length >= 2 && (
                    <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-xl px-4 py-3">
                      <p className="text-sm text-slate-400">No products found. Will add as custom item.</p>
                    </div>
                  )}
                </div>

                {/* Selected product preview */}
                {selectedProduct && (
                  <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                    {selectedProduct.image_url && (
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name}
                        className="w-12 h-12 rounded-lg object-contain bg-slate-700 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{selectedProduct.name}</p>
                      {selectedProduct.brand && (
                        <p className="text-xs text-slate-400 truncate">{selectedProduct.brand}</p>
                      )}
                      {(selectedProduct.description || selectedProduct.barcode) && (
                        <p className="text-xs text-slate-500 truncate">
                          {[selectedProduct.description, selectedProduct.barcode].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => { setSelectedProduct(null); setQuery(''); setCustomName('') }}
                      className="text-slate-500 hover:text-slate-300 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <QuantitySelector quantity={quantity} setQuantity={setQuantity} />

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  onClick={handleAddManual}
                  disabled={adding || (!selectedProduct && !customName.trim())}
                  className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 active:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add to List'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuantitySelector({ quantity, setQuantity }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">Quantity</label>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setQuantity(q => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          className="w-10 h-10 rounded-xl bg-slate-700 text-slate-200 text-xl font-bold flex items-center justify-center disabled:opacity-30 active:bg-slate-600 transition-colors"
        >
          −
        </button>
        <span className="text-2xl font-bold text-slate-100 w-8 text-center">{quantity}</span>
        <button
          onClick={() => setQuantity(q => Math.min(99, q + 1))}
          disabled={quantity >= 99}
          className="w-10 h-10 rounded-xl bg-slate-700 text-slate-200 text-xl font-bold flex items-center justify-center disabled:opacity-30 active:bg-slate-600 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}
