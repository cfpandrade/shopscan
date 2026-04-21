function normalise(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseTokenText(value) {
  return normalise(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value) {
  const ignoredTokens = new Set([
    'kg',
    'g',
    'mg',
    'lb',
    'oz',
    'l',
    'ml',
    'cl',
    'pack',
    'pk',
  ]);

  return normaliseTokenText(value)
    .split(' ')
    .filter(
      (token) =>
        token.length > 1 &&
        !/^\d+$/.test(token) &&
        !/^\d+(?:[.,]\d+)?(?:kg|g|mg|lb|oz|l|ml|cl)$/.test(token) &&
        !ignoredTokens.has(token)
    );
}

function uniqueTokens(values) {
  return [...new Set(values.flatMap((value) => tokenize(value)))];
}

function extractSizeCandidate(value) {
  const match = normalise(value).match(/\b(\d+(?:[.,]\d+)?)\s?(kg|g|mg|lb|oz|litres?|liters?|l|ml|cl)\b/i);
  if (!match) return null;

  const amount = Number.parseFloat(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();

  const mappings = {
    mg: { dimension: 'mass', baseAmount: amount / 1000, standardAmount: 1000, standardLabel: 'kg' },
    g: { dimension: 'mass', baseAmount: amount, standardAmount: 1000, standardLabel: 'kg' },
    kg: { dimension: 'mass', baseAmount: amount * 1000, standardAmount: 1000, standardLabel: 'kg' },
    oz: { dimension: 'mass', baseAmount: amount * 28.3495, standardAmount: 1000, standardLabel: 'kg' },
    lb: { dimension: 'mass', baseAmount: amount * 453.592, standardAmount: 1000, standardLabel: 'kg' },
    ml: { dimension: 'volume', baseAmount: amount, standardAmount: 1000, standardLabel: 'L' },
    cl: { dimension: 'volume', baseAmount: amount * 10, standardAmount: 1000, standardLabel: 'L' },
    l: { dimension: 'volume', baseAmount: amount * 1000, standardAmount: 1000, standardLabel: 'L' },
    litre: { dimension: 'volume', baseAmount: amount * 1000, standardAmount: 1000, standardLabel: 'L' },
    liter: { dimension: 'volume', baseAmount: amount * 1000, standardAmount: 1000, standardLabel: 'L' },
    litres: { dimension: 'volume', baseAmount: amount * 1000, standardAmount: 1000, standardLabel: 'L' },
    liters: { dimension: 'volume', baseAmount: amount * 1000, standardAmount: 1000, standardLabel: 'L' },
  };

  const mapping = mappings[unit];
  if (!mapping) return null;

  return {
    raw: match[0],
    amount,
    unit,
    ...mapping,
  };
}

function parseItemSize(item) {
  return (
    extractSizeCandidate(item?.product_size) ||
    extractSizeCandidate(item?.size) ||
    extractSizeCandidate(item?.description) ||
    extractSizeCandidate(item?.product_name) ||
    extractSizeCandidate(item?.custom_name) ||
    extractSizeCandidate(item?.name)
  );
}

function parseStoreSize(result) {
  return (
    extractSizeCandidate(result?.store_product_name) ||
    extractSizeCandidate(result?.price_per_unit)
  );
}

function parseUnitPriceText(value) {
  const text = normalise(value);
  const priceMatch = text.match(/€\s*(\d+(?:[.,]\d+)?)/i);
  if (!priceMatch) return null;

  const price = Number.parseFloat(priceMatch[1].replace(',', '.'));
  const size = extractSizeCandidate(text);
  if (!size) {
    if (/\/\s*kg\b/i.test(text) || /per\s+kg\b/i.test(text)) {
      return { dimension: 'mass', perStandardUnitPrice: price, standardLabel: 'kg' };
    }
    if (/\/\s*(?:l|litre|liter|litres|liters)\b/i.test(text) || /per\s+(?:l|litre|liter|litres|liters)\b/i.test(text)) {
      return { dimension: 'volume', perStandardUnitPrice: price, standardLabel: 'L' };
    }
    return null;
  }

  const perBaseUnitPrice = price / size.baseAmount;
  return {
    dimension: size.dimension,
    perStandardUnitPrice: perBaseUnitPrice * size.standardAmount,
    standardLabel: size.standardLabel,
  };
}

function calculateComparableUnitPrice(price, size) {
  if (price == null || !size) return null;
  if (!Number.isFinite(Number(price)) || !Number.isFinite(size.baseAmount) || size.baseAmount <= 0) {
    return null;
  }

  return {
    dimension: size.dimension,
    perStandardUnitPrice: (Number(price) / size.baseAmount) * size.standardAmount,
    standardLabel: size.standardLabel,
  };
}

function getComparablePrice(result) {
  return (
    parseUnitPriceText(result?.price_per_unit) ||
    calculateComparableUnitPrice(result?.price, parseStoreSize(result))
  );
}

function getNameCoverage(item, result) {
  const itemTokens = uniqueTokens([item?.brand, item?.product_name, item?.custom_name, item?.name]);
  const resultTokens = new Set(uniqueTokens([result?.store_product_name]));

  if (itemTokens.length === 0) return 0;
  let matches = 0;
  for (const token of itemTokens) {
    if (resultTokens.has(token)) matches += 1;
  }
  return matches / itemTokens.length;
}

function getNameOnlyCoverage(item, result) {
  const nameTokens = uniqueTokens([item?.product_name, item?.custom_name, item?.name]);
  const resultTokens = new Set(uniqueTokens([result?.store_product_name]));
  if (nameTokens.length === 0) return 0;
  let matches = 0;
  for (const token of nameTokens) {
    if (resultTokens.has(token)) matches += 1;
  }
  return matches / nameTokens.length;
}

function hasBrandMismatch(item, result) {
  const brandTokens = uniqueTokens([item?.brand]);
  if (brandTokens.length === 0) return false;
  const resultText = normaliseTokenText(result?.store_product_name);
  return !brandTokens.some((token) => resultText.includes(token));
}

export function assessStoreMatch(item, result) {
  if (!result) return null;

  const itemSize = parseItemSize(item);
  const storeSize = parseStoreSize(result);
  const comparablePrice = getComparablePrice(result);
  const nameCoverage = Math.max(getNameCoverage(item, result), getNameOnlyCoverage(item, result));
  const brandMismatch = hasBrandMismatch(item, result);

  let matchStatus = 'close';
  let matchLabel = 'Close match';
  let needsReview = false;

  if (nameCoverage < 0.4) {
    matchStatus = 'mismatch';
    matchLabel = 'Needs review';
    needsReview = true;
  }

  if (itemSize && storeSize && itemSize.dimension === storeSize.dimension) {
    const ratio = storeSize.baseAmount / itemSize.baseAmount;

    if (ratio >= 0.95 && ratio <= 1.05 && nameCoverage >= 0.55) {
      matchStatus = 'exact';
      matchLabel = 'Exact match';
      needsReview = false;
    } else if (comparablePrice && nameCoverage >= 0.55) {
      matchStatus = 'size_adjusted';
      matchLabel = `Compared by €/${comparablePrice.standardLabel}`;
      needsReview = false;
    } else if (nameCoverage < 0.55) {
      matchStatus = 'mismatch';
      matchLabel = 'Needs review';
      needsReview = true;
    }
  } else if (!itemSize && nameCoverage >= 0.6) {
    matchStatus = 'close';
    matchLabel = 'Close match';
    needsReview = false;
  }

  return {
    match_status: matchStatus,
    match_label: matchLabel,
    needs_review: needsReview,
    item_size: itemSize?.raw || null,
    store_size: storeSize?.raw || null,
    comparison_metric: comparablePrice?.perStandardUnitPrice ?? (result?.price != null ? Number(result.price) : null),
    comparison_unit: comparablePrice ? `€/${comparablePrice.standardLabel}` : null,
    comparison_value: comparablePrice?.perStandardUnitPrice ?? null,
    last_refresh_at: result?.fetched_at || null,
  };
}
