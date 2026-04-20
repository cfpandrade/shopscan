export function TescoLogo({ className = '' }) {
  return (
    <svg
      viewBox="0 0 80 28"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Tesco"
    >
      <rect width="80" height="28" rx="4" fill="#00539F" />
      <text
        x="40"
        y="20"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="16"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        Tesco
      </text>
    </svg>
  )
}

export function DunnesLogo({ className = '' }) {
  return (
    <svg
      viewBox="0 0 80 28"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Dunnes Stores"
    >
      <rect width="80" height="28" rx="4" fill="#E31837" />
      <text
        x="40"
        y="20"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="13"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        Dunnes
      </text>
    </svg>
  )
}
