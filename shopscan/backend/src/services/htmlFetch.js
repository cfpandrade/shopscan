import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(currentDir, '../scripts/fetchStoreHtml.py');

export async function fetchHtmlWithBrowserFingerprint(store, url) {
  try {
    const { stdout } = await execFileAsync(
      'python3',
      [scriptPath, '--store', store, '--url', url],
      {
        timeout: 35000,
        maxBuffer: 20 * 1024 * 1024,
      }
    );

    return stdout || null;
  } catch (error) {
    console.warn(`[${store}] Browser fingerprint fetch failed: ${error.stderr || error.message}`);
    return null;
  }
}
