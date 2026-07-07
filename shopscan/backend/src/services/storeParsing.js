import { load } from 'cheerio';
import { normaliseText, normaliseForMatch, wordSet, hasWord, compareSizes } from './textMatch.js';

function normalise(value) {
  return normaliseText(value);
}

function cleanStoreProductName(value) {
  return normalise(value).replace(/Open Product Description$/i, '').trim();
}

function parsePrice(text) {
  const match = normalise(text).match(/€\s*(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : null;
}

function matchScore(query, name) {
  const queryText = normaliseForMatch(query);
  const nameText = normaliseForMatch(name);

  if (!queryText || !nameText) return 0;
  if (queryText === nameText) return 1000;
  // Whole-phrase presence, on word boundaries ("ham" must not hit "graham").
  if (` ${nameText} `.includes(` ${queryText} `)) return 700;

  const queryTokens = queryText.split(' ').filter((token) => token.length > 1 && !/^\d+$/.test(token));
  const nameWords = wordSet(nameText);
  let score = 0;

  for (const token of queryTokens) {
    if (hasWord(nameWords, token)) {
      score += Math.min(token.length * 8, 80);
    }
  }

  // Whole-word matches only (a "ham" query must not match "graham"), so a
  // zero score means the result shares nothing with the query — it is one of
  // the store's "you might like" suggestions, not a hit.
  if (score === 0) return 0;

  const sizeComparison = compareSizes(query, name);
  if (sizeComparison === 'match') score += 60;
  if (sizeComparison === 'conflict') score -= 40;

  return Math.max(score, 1);
}

// Own-label brands per store. Own-brand products are typically the cheapest,
// so they win when two results match the query equally well (see sortResults).
const OWN_BRAND_PATTERNS = {
  tesco: [/\btesco\b/i],
  dunnes: [/\bdunnes\b/i, /\bst\.?\s*bernard\b/i, /\bsimply\s+better\b/i, /\bmy\s+family\b/i],
};

export function isOwnBrand(store, name) {
  const patterns = OWN_BRAND_PATTERNS[store] || [];
  const text = normalise(name);
  if (!text) return false;
  return patterns.some((pattern) => pattern.test(text));
}

function sortResults(results, query, store) {
  const hasQuery = normaliseForMatch(query).length > 0;

  return results
    .map((result, index) => ({
      ...result,
      _score: matchScore(query, result.store_product_name),
      _ownBrand: isOwnBrand(store, result.store_product_name) ? 1 : 0,
      _index: index,
    }))
    // A named result sharing no words with the query is a suggestion tile
    // (or a hit for a raw-barcode query) — never return it as a match.
    .filter((result) => !hasQuery || !result.store_product_name || result._score > 0)
    .sort((left, right) => {
      if (right._score !== left._score) return right._score - left._score;
      // Equally good match → prefer the store's own (cheaper) label.
      if (right._ownBrand !== left._ownBrand) return right._ownBrand - left._ownBrand;
      return left._index - right._index;
    })
    .map(({ _score, _ownBrand, _index, ...result }) => result);
}

const NO_RESULTS_PATTERN =
  /couldn'?t find any results|no results found|no products found|we found 0 results|0 results for|didn'?t match any products/i;

function isNoResultsPage($) {
  const clone = $.root().clone();
  clone.find('script, style, noscript, template').remove();
  return NO_RESULTS_PATTERN.test(normalise(clone.text()));
}

function firstPriceLikeText(texts, predicate) {
  for (const text of texts) {
    if (!/^€\s*\d/.test(text)) continue;
    if (predicate(text)) return text;
  }

  return null;
}

function collectPriceTexts($, container) {
  return $(container)
    .find('p, span, div')
    .toArray()
    .map((element) => normalise($(element).text()))
    .filter(Boolean);
}

function toAbsoluteUrl(baseUrl, href) {
  if (!href) return null;
  return href.startsWith('http') ? href : `${baseUrl}${href}`;
}

export function extractTescoResultsFromHtml(html, query = '') {
  const $ = load(html);
  if (query && isNoResultsPage($)) return [];
  const results = [];

  $('li[data-testid][data-auto-available], li[data-testid]').each((_, element) => {
    const tile = $(element);
    const titleLink = tile.find('h2 a[href*="/products/"], a[href*="/products/"]').first();
    const href = titleLink.attr('href');
    if (!href) return;

    const product_url = toAbsoluteUrl('https://www.tesco.ie', href);
    const store_product_name = cleanStoreProductName(titleLink.text());
    const image = tile.find('img[src], img[data-src], img[data-lazy-src]').first();
    const image_url = toAbsoluteUrl(
      'https://www.tesco.ie',
      image.attr('src') || image.attr('data-src') || image.attr('data-lazy-src')
    );

    const directPrice = normalise(
      tile.find('.ddsweb-price__container [class*="priceText"], .ddsweb-buybox__price [class*="priceText"]').first().text()
    );
    const directUnitPrice = normalise(
      tile.find('.ddsweb-price__subtext, [class*="subtext"]').first().text()
    );

    const allPriceTexts = collectPriceTexts($, tile);
    const priceText = directPrice || firstPriceLikeText(allPriceTexts, (text) => !text.includes('/'));
    const price_per_unit =
      directUnitPrice || firstPriceLikeText(allPriceTexts, (text) => text.includes('/'));

    results.push({
      store: 'tesco',
      price: parsePrice(priceText),
      price_per_unit: price_per_unit || null,
      product_url,
      store_product_name: store_product_name || null,
      image_url: image_url || null,
    });
  });

  return sortResults(
    results.filter((result) => result.price != null || result.store_product_name || result.image_url),
    query,
    'tesco'
  ).slice(0, 5);
}

export function extractDunnesResultsFromHtml(html, query = '') {
  const $ = load(html);
  if (query && isNoResultsPage($)) return [];
  const results = [];

  $('article[data-testid^="ProductCardWrapper-"]').each((_, element) => {
    const card = $(element);
    const link = card.find('a[href*="/product/"]').first();
    const product_url = toAbsoluteUrl(
      'https://www.dunnesstoresgrocery.com',
      link.attr('href')
    );

    const store_product_name = cleanStoreProductName(
      card.find('h3[data-testid$="-ProductNameTestId"], [data-testid$="-ProductNameTestId"]').first().text()
    ) || cleanStoreProductName(card.find('img').first().attr('alt'));

    const image = card.find('[data-testid^="productCardImage_"] img, img[src]').first();
    const image_url = toAbsoluteUrl(
      'https://www.dunnesstoresgrocery.com',
      image.attr('src') || image.attr('data-src') || image.attr('data-lazy-src')
    );

    const directPrice = normalise(card.find('[class*="ProductPrice--"]').first().text());
    const directUnitPrice = normalise(card.find('[class*="ProductUnitPrice--"]').first().text());
    const allPriceTexts = collectPriceTexts($, card);

    const priceText = directPrice || firstPriceLikeText(allPriceTexts, (text) => !text.includes('/'));
    const price_per_unit =
      directUnitPrice || firstPriceLikeText(allPriceTexts, (text) => text.includes('/'));

    results.push({
      store: 'dunnes',
      price: parsePrice(priceText),
      price_per_unit: price_per_unit || null,
      product_url: product_url || null,
      store_product_name: store_product_name || null,
      image_url: image_url || null,
    });
  });

  return sortResults(
    results.filter((result) => result.price != null || result.store_product_name || result.image_url),
    query,
    'dunnes'
  ).slice(0, 5);
}

export function extractTescoProductFromHtml(html, url) {
  const $ = load(html);

  // Try search-result format first (sometimes embedded in PDP)
  const fromSearch = extractTescoResultsFromHtml(html, '');
  if (fromSearch.length > 0 && fromSearch[0].price != null) {
    return { ...fromSearch[0], product_url: url };
  }

  const name = cleanStoreProductName(
    $('[data-auto="pdp-heading"], h1[class*="styled"], h1').first().text()
  );
  const priceText = normalise(
    $('[class*="ddsweb-price__text"], [class*="priceText"], [itemprop="price"]').first().text() ||
    $('[itemprop="price"]').attr('content') || ''
  );
  const unitPrice = normalise(
    $('[class*="ddsweb-price__subtext"], [class*="price-control__extra-text"]').first().text()
  );
  const image = $('img[class*="product-image"], img[data-testid*="main"], .product-gallery img').first();
  const price = parsePrice(priceText);

  if (!price && !name) return null;
  return {
    store: 'tesco',
    price,
    price_per_unit: unitPrice || null,
    product_url: url,
    store_product_name: name || null,
    image_url: image.attr('src') || image.attr('data-src') || null,
  };
}

export function extractDunnesProductFromHtml(html, url) {
  const $ = load(html);

  // Try search-result format first
  const fromSearch = extractDunnesResultsFromHtml(html, '');
  if (fromSearch.length > 0 && fromSearch[0].price != null) {
    return { ...fromSearch[0], product_url: url };
  }

  const name = cleanStoreProductName(
    $('[data-testid$="-ProductNameTestId"], h1[class*="product"], h1').first().text()
  );
  const priceText = normalise(
    $('[class*="ProductPrice--"], [data-testid*="price"]').first().text()
  );
  const unitPrice = normalise(
    $('[class*="ProductUnitPrice--"], [data-testid*="unit-price"]').first().text()
  );
  const image = $('[data-testid*="productImage"] img, img[class*="product-image"]').first();
  const price = parsePrice(priceText);

  if (!price && !name) return null;
  return {
    store: 'dunnes',
    price,
    price_per_unit: unitPrice || null,
    product_url: url,
    store_product_name: name || null,
    image_url: image.attr('src') || image.attr('data-src') || null,
  };
}
