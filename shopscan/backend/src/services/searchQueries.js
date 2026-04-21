function normaliseSearchValue(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function combineSegments(values) {
  const combined = [];

  for (const value of values) {
    const normalised = normaliseSearchValue(value);
    if (!normalised) continue;

    const key = normalised.toLowerCase();
    const exactIndex = combined.findIndex((entry) => entry.toLowerCase() === key);
    if (exactIndex >= 0) continue;

    const coveredIndex = combined.findIndex((entry) => key.includes(entry.toLowerCase()));
    if (coveredIndex >= 0) {
      combined[coveredIndex] = normalised;
      continue;
    }

    const redundant = combined.some((entry) => entry.toLowerCase().includes(key));
    if (!redundant) {
      combined.push(normalised);
    }
  }

  return normaliseSearchValue(combined.join(' '));
}

function addCandidate(candidates, seen, value) {
  const normalised = normaliseSearchValue(value);
  if (!normalised) return;

  const key = normalised.toLowerCase();
  if (seen.has(key)) return;

  seen.add(key);
  candidates.push(normalised);
}

function getBarcodeCandidate(item) {
  const barcode = normaliseSearchValue(item?.product_barcode || item?.barcode);
  if (!barcode) return null;
  return /^\d{8,}$/.test(barcode) ? barcode : null;
}

function getNameCandidate(item) {
  return normaliseSearchValue(item?.custom_name || item?.product_name || item?.name);
}

function getBrandNameCandidate(item) {
  const brand = normaliseSearchValue(item?.brand);
  const name = normaliseSearchValue(item?.product_name || item?.custom_name || item?.name);
  return combineSegments([brand, name]);
}

function getDescriptionCandidate(item) {
  return normaliseSearchValue(item?.description);
}

function getSizeCandidate(item) {
  const explicitSize = normaliseSearchValue(item?.product_size || item?.size);
  if (explicitSize) return explicitSize;

  const inferredSource = normaliseSearchValue([
    item?.product_name,
    item?.custom_name,
    item?.name,
    item?.description,
  ].filter(Boolean).join(' '));

  const matches = inferredSource.match(/\b\d+(?:[.,]\d+)?\s?(?:kg|g|mg|l|ml|cl|oz|lb)\b/gi);
  return matches ? combineSegments(matches) : null;
}

function getBrandNameSizeCandidate(item) {
  return combineSegments([
    item?.brand,
    item?.product_name || item?.custom_name || item?.name,
    getSizeCandidate(item),
  ]);
}

function getNameSizeCandidate(item) {
  return combineSegments([
    item?.product_name || item?.custom_name || item?.name,
    getSizeCandidate(item),
  ]);
}

function getDescriptionSizeCandidate(item) {
  return combineSegments([item?.description, getSizeCandidate(item)]);
}

function stripTescoPrefix(value) {
  return normaliseSearchValue(value)
    .replace(/^tesco(?:\s+ireland)?[\s:-]*/i, '')
    .replace(/\btesco\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isTescoOwnBrand(item) {
  const brand = normaliseSearchValue(item?.brand);
  const name = normaliseSearchValue(item?.product_name || item?.custom_name || item?.name);
  return /\btesco\b/i.test(brand) || /^tesco\b/i.test(name);
}

export function getPrimarySearchQuery(item) {
  return (
    getBrandNameSizeCandidate(item) ||
    getBrandNameCandidate(item) ||
    getNameSizeCandidate(item) ||
    getNameCandidate(item) ||
    getDescriptionSizeCandidate(item) ||
    getDescriptionCandidate(item) ||
    getBarcodeCandidate(item) ||
    null
  );
}

export function buildSearchQueries(itemOrQuery) {
  if (typeof itemOrQuery === 'string') {
    const query = normaliseSearchValue(itemOrQuery);
    return query ? [query] : [];
  }

  const candidates = [];
  const seen = new Set();

  addCandidate(candidates, seen, getBarcodeCandidate(itemOrQuery));
  addCandidate(candidates, seen, getPrimarySearchQuery(itemOrQuery));
  addCandidate(candidates, seen, getBrandNameCandidate(itemOrQuery));
  addCandidate(candidates, seen, getNameSizeCandidate(itemOrQuery));
  addCandidate(candidates, seen, getNameCandidate(itemOrQuery));

  const description = getDescriptionCandidate(itemOrQuery);
  const brand = normaliseSearchValue(itemOrQuery?.brand);
  const size = getSizeCandidate(itemOrQuery);

  addCandidate(candidates, seen, combineSegments([brand, description, size]));
  addCandidate(candidates, seen, getDescriptionSizeCandidate(itemOrQuery));
  addCandidate(candidates, seen, description);
  addCandidate(candidates, seen, size);

  return candidates;
}

export function buildStoreSearchQueries(itemOrQuery, store) {
  if (typeof itemOrQuery === 'string') {
    return buildSearchQueries(itemOrQuery);
  }

  if (store !== 'dunnes' || !isTescoOwnBrand(itemOrQuery)) {
    return buildSearchQueries(itemOrQuery);
  }

  const candidates = [];
  const seen = new Set();
  const genericName = stripTescoPrefix(getNameCandidate(itemOrQuery));
  const genericNameWithSize = stripTescoPrefix(getNameSizeCandidate(itemOrQuery));
  const genericDescription = stripTescoPrefix(getDescriptionCandidate(itemOrQuery));
  const genericDescriptionWithSize = stripTescoPrefix(getDescriptionSizeCandidate(itemOrQuery));
  const genericBrandName = stripTescoPrefix(getBrandNameCandidate(itemOrQuery));
  const genericBrandNameWithSize = stripTescoPrefix(getBrandNameSizeCandidate(itemOrQuery));

  addCandidate(candidates, seen, genericBrandNameWithSize);
  addCandidate(candidates, seen, genericNameWithSize);
  addCandidate(candidates, seen, genericName);
  addCandidate(candidates, seen, genericBrandName);
  addCandidate(candidates, seen, genericDescriptionWithSize);
  addCandidate(candidates, seen, genericDescription);
  addCandidate(
    candidates,
    seen,
    combineSegments([genericNameWithSize || genericName, genericDescriptionWithSize || genericDescription])
  );

  return candidates.length > 0 ? candidates : buildSearchQueries(itemOrQuery);
}
