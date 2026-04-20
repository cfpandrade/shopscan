import { useEffect, useRef } from 'react'
import useBarcodeScanner from '../hooks/useBarcodeScanner'

export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null)
  const { scanning, result, error, startScan, stopScan } = useBarcodeScanner()
  const resultHandled = useRef(false)

  useEffect(() => {
    if (videoRef.current) {
      startScan(videoRef)
    }
    return () => {
      stopScan()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result && !resultHandled.current) {
      resultHandled.current = true
      stopScan()
      if (navigator.vibrate) navigator.vibrate(200)
      onResult(result)
    }
  }, [result, stopScan, onResult])

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full max-w-sm aspect-video bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />

        {/* Targeting reticle overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg
            viewBox="0 0 240 160"
            className="w-60 h-40"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Corner marks */}
            {/* Top-left */}
            <path d="M20 50 L20 20 L50 20" stroke="#22c55e" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* Top-right */}
            <path d="M190 20 L220 20 L220 50" stroke="#22c55e" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* Bottom-left */}
            <path d="M20 110 L20 140 L50 140" stroke="#22c55e" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* Bottom-right */}
            <path d="M190 140 L220 140 L220 110" stroke="#22c55e" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* Center crosshair */}
            <line x1="115" y1="80" x2="125" y2="80" stroke="#22c55e" strokeWidth="2" opacity="0.7" />
            <line x1="120" y1="75" x2="120" y2="85" stroke="#22c55e" strokeWidth="2" opacity="0.7" />
          </svg>
        </div>

        {scanning && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <span className="text-xs text-green-400 bg-black/60 px-3 py-1 rounded-full animate-pulse">
              Scanning...
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 w-full max-w-sm">
          <p className="text-red-400 text-sm text-center mb-3">
            Camera unavailable. Enter barcode manually:
          </p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 5000169077421"
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-center tracking-widest"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                if (navigator.vibrate) navigator.vibrate(200)
                onResult(e.target.value.trim())
              }
            }}
          />
          <p className="text-xs text-slate-400 text-center mt-1">Press Enter to confirm</p>
        </div>
      )}

      <button
        onClick={() => { stopScan(); onClose() }}
        className="mt-4 px-6 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 active:bg-slate-500 transition-colors text-sm"
      >
        Cancel
      </button>
    </div>
  )
}
