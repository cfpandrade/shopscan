import { readFile } from 'node:fs/promises';
import { extractTescoResultsFromHtml, extractDunnesResultsFromHtml } from '../services/storeParsing.js';

const [tescoPath, dunnesPath, query = 'Ferrero rocher'] = process.argv.slice(2);

if (!tescoPath || !dunnesPath) {
  console.error('Usage: node src/scripts/verifyStoreHtml.js <tesco-html> <dunnes-html> [query]');
  process.exit(1);
}

const [tescoHtml, dunnesHtml] = await Promise.all([
  readFile(tescoPath, 'utf8'),
  readFile(dunnesPath, 'utf8'),
]);

const tesco = extractTescoResultsFromHtml(tescoHtml, query);
const dunnes = extractDunnesResultsFromHtml(dunnesHtml, query);

const payload = {
  query,
  tesco: tesco[0] || null,
  dunnes: dunnes[0] || null,
};

console.log(JSON.stringify(payload, null, 2));

if (!payload.tesco?.price || !payload.tesco?.image_url || !payload.dunnes?.price || !payload.dunnes?.image_url) {
  process.exit(1);
}
