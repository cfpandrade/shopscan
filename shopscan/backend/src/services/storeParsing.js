import { load } from 'cheerio';

function normalise(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanStoreProductName(value) {
  return normalise(value).replace(/Open Product Description$/i, '').trim();
}

function parsePrice(text) {
  const match = normalise(text).match(/€\s*(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : null;
}

function normaliseForMatch(value) {
  return normalise(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchScore(query, name) {
  const queryText = normaliseForMatch(query);
  const nameText = normaliseForMatch(name);

  if (!queryText || !nameText) return 0;
  if (queryText === nameText) return 1000;
  if (nameText.includes(queryText)) return 700;

  const queryTokens = queryText.split(' ').filter((token) => token.length > 1);
  let score = 0;

  for (const token of queryTokens) {
    if (nameText.includes(token)) {
      score += /^\d{8,}$/.test(token) ? 250 : Math.min(token.length * 8, 80);
    }
  }

  return score;
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
  return results
    .map((result, index) => ({
      ...result,
      _score: matchScore(query, result.store_product_name),
      _ownBrand: isOwnBrand(store, result.store_product_name) ? 1 : 0,
      _index: index,
    }))
    .sort((left, right) => {
      if (right._score !== left._score) return right._score - left._score;
      // Equally good match → prefer the store's own (cheaper) label.
      if (right._ownBrand !== left._ownBrand) return right._ownBrand - left._ownBrand;
      return left._index - right._index;
    })
    .map(({ _score, _ownBrand, _index, ...result }) => result);
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
  ).slice(0, 3);
}

export function extractDunnesResultsFromHtml(html, query = '') {
  const $ = load(html);
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
  ).slice(0, 3);
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
