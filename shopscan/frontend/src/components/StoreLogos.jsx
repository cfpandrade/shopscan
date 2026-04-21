export function TescoLogo({ className = '' }) {
  // Tesco brand: red "TESCO" serif text with blue zig-zag underline
  return (
    <svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Tesco">
      {/* Red TESCO text - bold serif */}
      <text
        x="50"
        y="24"
        textAnchor="middle"
        fill="#E81C2F"
        fontSize="22"
        fontWeight="900"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="-0.5"
      >
        TESCO
      </text>
      {/* Blue zig-zag stripes underneath (signature brand element) */}
      <g fill="#00539F">
        <path d="M 8,32 L 22,32 L 16,38 L 2,38 Z" />
        <path d="M 24,32 L 38,32 L 32,38 L 18,38 Z" />
        <path d="M 40,32 L 54,32 L 48,38 L 34,38 Z" />
        <path d="M 56,32 L 70,32 L 64,38 L 50,38 Z" />
        <path d="M 72,32 L 86,32 L 80,38 L 66,38 Z" />
        <path d="M 88,32 L 98,32 L 94,38 L 82,38 Z" />
      </g>
    </svg>
  )
}

export function DunnesLogo({ className = '' }) {
  // Dunnes Stores: monochrome wordmark used on a light chip
  return (
    <svg viewBox="0 0 140 40" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Dunnes Stores">
      <text
        x="8"
        y="24"
        fill="currentColor"
        fontSize="22"
        fontWeight="800"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        letterSpacing="0.9"
      >
        DUNNES
      </text>
      <text
        x="72"
        y="38"
        fill="currentColor"
        fontSize="12"
        fontWeight="700"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        letterSpacing="1.9"
      >
        STORES
      </text>
    </svg>
  )
}
