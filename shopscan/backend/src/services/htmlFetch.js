import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function fetchHtmlWithBrowserFingerprint(store, url) {
  try {
    const { stdout } = await execFileAsync(
      'python3',
      ['/app/backend/src/scripts/fetchStoreHtml.py', '--store', store, '--url', url],
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
