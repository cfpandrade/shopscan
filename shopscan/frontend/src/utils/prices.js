// Shared best-store logic. Unit prices (€/kg, €/L) are only compared against
// unit prices in the same unit; otherwise we compare absolute prices, so a
// €/kg figure is never ranked against a plain € one.

function usable(entry) {
  if (!entry || entry.needs_review) return null
  return entry.comparison_value != null || entry.price != null ? entry : null
}

export function getBestStore(prices) {
  if (!prices) return null
  const tesco = usable(prices.tesco)
  const dunnes = usable(prices.dunnes)

  if (!tesco && !dunnes) return null
  if (!tesco) return 'dunnes'
  if (!dunnes) return 'tesco'

  if (
    tesco.comparison_value != null &&
    dunnes.comparison_value != null &&
    tesco.comparison_unit === dunnes.comparison_unit
  ) {
    return Number(tesco.comparison_value) <= Number(dunnes.comparison_value) ? 'tesco' : 'dunnes'
  }

  if (tesco.price != null && dunnes.price != null) {
    return Number(tesco.price) <= Number(dunnes.price) ? 'tesco' : 'dunnes'
  }

  return tesco.price != null ? 'tesco' : 'dunnes'
}
