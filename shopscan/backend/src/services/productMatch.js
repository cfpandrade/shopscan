import {
  normaliseText,
  normaliseForMatch,
  normaliseToken,
  wordSet,
  hasWord,
  extractSizeCandidate,
} from './textMatch.js';
import { isOwnBrand } from './storeParsing.js';

function normalise(value) {
  return normaliseText(value);
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

  return normaliseForMatch(value)
    .split(' ')
    .filter(
      (token) =>
        token.length > 1 &&
        !/^\d+$/.test(token) &&
        !/^\d+(?:[.,]\d+)?(?:kg|g|mg|lb|oz|l|ml|cl)$/.test(token) &&
        !ignoredTokens.has(token)
    )
    .map((token) => normaliseToken(token));
}

function uniqueTokens(values) {
  return [...new Set(values.flatMap((value) => tokenize(value)))];
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
  const resultWords = wordSet(result?.store_product_name);
  return !brandTokens.some((token) => hasWord(resultWords, token));
}

const STORE_BRAND_NAMES = ['tesco', 'dunnes', 'st bernard', 'simply better', 'my family'];

function isStoreOwnBrandItem(item) {
  const text = normaliseForMatch([item?.brand, item?.product_name, item?.custom_name, item?.name].filter(Boolean).join(' '));
  return STORE_BRAND_NAMES.some((brand) => text.includes(brand));
}

/**
 * A Tesco own-brand item matched to a Dunnes own-brand product (or vice
 * versa) is the intended generic substitution, not a brand mismatch.
 */
function isOwnBrandEquivalent(item, result, store) {
  if (!store) return false;
  return isStoreOwnBrandItem(item) && isOwnBrand(store, result?.store_product_name);
}

function getBrandMismatch(item, result, store) {
  return hasBrandMismatch(item, result) && !isOwnBrandEquivalent(item, result, store);
}

/**
 * Relevance of a store result for a list item, used to pick the best result
 * across search-query variants. Roughly 0..1.35; ≥0.75 is a confident match.
 */
export function scoreStoreResult(item, result, store) {
  if (!result || result.error || !result.store_product_name) return 0;

  const nameCoverage = Math.max(getNameCoverage(item, result), getNameOnlyCoverage(item, result));
  if (nameCoverage === 0) return 0;

  let score = nameCoverage;

  const itemSize = parseItemSize(item);
  const storeSize = parseStoreSize(result);
  if (itemSize && storeSize && itemSize.dimension === storeSize.dimension) {
    const ratio = storeSize.baseAmount / itemSize.baseAmount;
    score += ratio >= 0.95 && ratio <= 1.05 ? 0.2 : -0.15;
  }

  const brandTokens = uniqueTokens([item?.brand]);
  if (brandTokens.length > 0) {
    score += getBrandMismatch(item, result, store) ? -0.3 : 0.15;
  }

  return score;
}

export function assessStoreMatch(item, result, store) {
  if (!result) return null;

  const itemSize = parseItemSize(item);
  const storeSize = parseStoreSize(result);
  const comparablePrice = getComparablePrice(result);
  const nameCoverage = Math.max(getNameCoverage(item, result), getNameOnlyCoverage(item, result));
  const brandMismatch = getBrandMismatch(item, result, store);

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

  // The item names a brand that the store result does not carry: flag it for
  // review even when the generic words line up, so a Finish item never passes
  // silently as a Fairy price.
  if (brandMismatch) {
    if (matchStatus === 'exact') matchStatus = 'close';
    matchLabel = 'Different brand';
    needsReview = true;
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
