import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const SINGLE_REFRESH_TIMEOUT_MS = 60000
const BULK_REFRESH_TIMEOUT_MS = 180000

export default function useShoppingList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/list')
      setItems(res.data)
    } catch (err) {
      setError(err.message || 'Failed to load list')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const addItem = useCallback(async (data) => {
    try {
      await api.post('/list', data)
      await fetchList()
    } catch (err) {
      setError(err.message || 'Failed to add item')
      throw err
    }
  }, [fetchList])

  const updateItem = useCallback(async (id, data) => {
    // Optimistic update
    setItems(prev =>
      prev.map(item => item.id === id ? { ...item, ...data } : item)
    )
    try {
      const res = await api.patch(`/list/${id}`, data)
      setItems(prev =>
        prev.map(item => item.id === id ? { ...item, ...res.data } : item)
      )
    } catch (err) {
      setError(err.message || 'Failed to update item')
      // Revert on error
      await fetchList()
      throw err
    }
  }, [fetchList])

  const deleteItem = useCallback(async (id) => {
    setItems(prev => prev.filter(item => item.id !== id))
    try {
      await api.delete(`/list/${id}`)
    } catch (err) {
      setError(err.message || 'Failed to delete item')
      await fetchList()
      throw err
    }
  }, [fetchList])

  const checkItem = useCallback(async (id, checked) => {
    setItems(prev =>
      prev.map(item => item.id === id ? { ...item, checked } : item)
    )
    try {
      await api.patch(`/list/${id}`, { checked })
    } catch (err) {
      setError(err.message || 'Failed to update item')
      await fetchList()
      throw err
    }
  }, [fetchList])

  const clearChecked = useCallback(async () => {
    setItems(prev => prev.filter(item => !item.checked))
    try {
      await api.delete('/list/checked')
    } catch (err) {
      setError(err.message || 'Failed to clear checked items')
      await fetchList()
      throw err
    }
  }, [fetchList])

  const refreshPrices = useCallback(async (id) => {
    try {
      await api.post(`/list/${id}/refresh-prices`, {}, { timeout: SINGLE_REFRESH_TIMEOUT_MS })
      await fetchList()
    } catch (err) {
      setError(err.message || 'Failed to refresh prices')
      throw err
    }
  }, [fetchList])

  const refreshAllPrices = useCallback(async () => {
    try {
      await api.post('/list/refresh-prices', {}, { timeout: BULK_REFRESH_TIMEOUT_MS })
      await fetchList()
    } catch (err) {
      setError(err.message || 'Failed to refresh all prices')
      throw err
    }
  }, [fetchList])

  return {
    items,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    checkItem,
    clearChecked,
    refreshPrices,
    refreshAllPrices,
    refetch: fetchList
  }
}
