import { useState, useRef, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

export default function useBarcodeScanner() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const readerRef = useRef(null)

  const startScan = useCallback(async (videoRef) => {
    setError(null)
    setResult(null)
    setScanning(true)

    try {
      const hints = new Map()
      const reader = new BrowserMultiFormatReader(hints)
      readerRef.current = reader

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      }

      await reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, err) => {
          if (result) {
            setResult(result.getText())
            setScanning(false)
          }
          if (err && err.name !== 'NotFoundException') {
            // NotFoundException is thrown continuously when no barcode in frame — ignore
            console.warn('Scanner error:', err)
          }
        }
      )
    } catch (err) {
      setError(err.message || 'Camera unavailable')
      setScanning(false)
    }
  }, [])

  const stopScan = useCallback(() => {
    if (readerRef.current) {
      try {
        BrowserMultiFormatReader.releaseAllStreams()
      } catch (e) {
        // ignore
      }
      readerRef.current = null
    }
    setScanning(false)
  }, [])

  return { scanning, result, error, startScan, stopScan }
}
