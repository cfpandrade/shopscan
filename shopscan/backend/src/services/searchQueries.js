function normaliseSearchValue(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
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
  return normaliseSearchValue([brand, name].filter(Boolean).join(' '));
}

function getDescriptionCandidate(item) {
  return normaliseSearchValue(item?.description);
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
    getBrandNameCandidate(item) ||
    getNameCandidate(item) ||
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
  addCandidate(candidates, seen, getNameCandidate(itemOrQuery));

  const description = getDescriptionCandidate(itemOrQuery);
  const brand = normaliseSearchValue(itemOrQuery?.brand);

  addCandidate(candidates, seen, normaliseSearchValue([brand, description].filter(Boolean).join(' ')));
  addCandidate(candidates, seen, description);

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
  const genericDescription = stripTescoPrefix(getDescriptionCandidate(itemOrQuery));
  const genericBrandName = stripTescoPrefix(getBrandNameCandidate(itemOrQuery));

  addCandidate(candidates, seen, genericName);
  addCandidate(candidates, seen, genericBrandName);
  addCandidate(candidates, seen, genericDescription);
  addCandidate(
    candidates,
    seen,
    normaliseSearchValue([genericName, genericDescription].filter(Boolean).join(' '))
  );

  return candidates.length > 0 ? candidates : buildSearchQueries(itemOrQuery);
}
