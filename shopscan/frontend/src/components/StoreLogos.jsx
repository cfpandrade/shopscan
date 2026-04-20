export function TescoLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 72 24" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Tesco">
      <rect width="72" height="24" rx="12" fill="#00539F" />
      {/* Tesco pill logo style */}
      <text x="36" y="17" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="0.5">
        tesco
      </text>
    </svg>
  )
}

export function DunnesLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 80 24" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Dunnes Stores">
      <rect width="80" height="24" rx="4" fill="#cc0000" />
      {/* Red stripe accent */}
      <rect width="80" height="4" y="20" rx="0" fill="#990000" />
      <text x="40" y="16" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="0.3">
        DUNNES
      </text>
    </svg>
  )
}
