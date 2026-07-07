// Shared text normalisation used by both search-result ranking (storeParsing)
// and item↔result matching (productMatch), so the two layers agree on what
// counts as "the same word".

const SPELLING_VARIANTS = {
  yoghurt: 'yogurt',
  doughnut: 'donut',
  chilli: 'chili',
  barbeque: 'barbecue',
  bbq: 'barbecue',
};

export function normaliseText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseForMatch(value) {
  return normaliseText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Canonicalises a single lowercase word: singularises simple plurals and maps
 * known spelling variants (yoghurt→yogurt) so both sides of a comparison land
 * on the same form.
 */
export function normaliseToken(token) {
  let word = String(token || '').toLowerCase();

  if (word.length > 4 && word.endsWith('ies')) {
    word = `${word.slice(0, -3)}y`;
  } else if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
    word = word.slice(0, -1);
  }

  return SPELLING_VARIANTS[word] || word;
}

/**
 * Set of whole words in the value, in both raw and canonical form.
 * Membership checks against this set are word-boundary safe (unlike
 * substring matching, "ham" will not match "graham").
 */
export function wordSet(value) {
  const words = new Set();
  for (const word of normaliseForMatch(value).split(' ')) {
    if (!word) continue;
    words.add(word);
    words.add(normaliseToken(word));
  }
  return words;
}

export function hasWord(words, token) {
  return words.has(token) || words.has(normaliseToken(token));
}

export function extractSizeCandidate(value) {
  const match = normaliseText(value).match(
    /\b(\d+(?:[.,]\d+)?)\s?(kg|g|mg|lb|oz|litres?|liters?|l|ml|cl)\b/i
  );
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

/**
 * Compares the first size found in each text. Returns 'match' when both carry
 * a size of the same dimension within ±5%, 'conflict' when both carry a size
 * but they differ, and null when either side has no size.
 */
export function compareSizes(leftText, rightText) {
  const left = extractSizeCandidate(leftText);
  const right = extractSizeCandidate(rightText);
  if (!left || !right || left.dimension !== right.dimension) return null;

  const ratio = right.baseAmount / left.baseAmount;
  return ratio >= 0.95 && ratio <= 1.05 ? 'match' : 'conflict';
}
