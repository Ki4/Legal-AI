/**
 * rada.mjs — read the current revision date of a law from zakon.rada.gov.ua.
 *
 * This is the fragile + rate-limit-sensitive part of law monitoring: we scrape an HTML page
 * and pull the "Редакція від DD.MM.YYYY" header. Built to scale with the number of watched
 * laws — transient failures retry with exponential backoff (honoring Retry-After), so a law
 * is only skipped after it is genuinely unreachable, not on a single blip.
 *
 * Layers (each independently testable):
 *   - extractRevisionDate(html) — pure parser, no I/O.
 *   - fetchWithRetry(url, opts) — polite HTTP with backoff on 429/5xx + network errors.
 *   - fetchRevisionDate(url, opts) — fetch the main page + extract the date.
 *
 * Parsing patterns carried over from scripts/seed-divorce-laws.ts.
 */

const USER_AGENT = 'Mozilla/5.0 (compatible; LegalAI-Bot/1.0)';

const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept-Language': 'uk,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml',
};

// Transient statuses worth retrying. 429 = rate limited; 5xx = server hiccup / overload.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Extract the law's current revision date from page HTML.
 * Returns an ISO date string (YYYY-MM-DD) or null if no recognizable date is found.
 *
 * Priority order, most specific first. We deliberately do NOT match a bare
 * "від DD.MM.YYYY" — that also matches the law's original adoption date.
 */
export function extractRevisionDate(html) {
  if (!html || typeof html !== 'string') return null;
  const patterns = [
    /[Рр]едакція від (\d{2}\.\d{2}\.\d{4})/,
    /станом на (\d{2}\.\d{2}\.\d{4})/,
    /поточна редакція.*?(\d{2}\.\d{2}\.\d{4})/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const [d, m, y] = match[1].split('.');
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

/** Normalize a law URL to the main page (the revision header lives there, not on /print). */
export function toMainPageUrl(url) {
  return String(url || '').replace(/\/print\/?$/, '').replace(/\/$/, '');
}

/**
 * Parse a Retry-After header into milliseconds. Supports both the "delta-seconds" form
 * (e.g. "120") and the HTTP-date form. Returns null if absent / unparseable.
 */
export function parseRetryAfter(value) {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(value);
  return Number.isNaN(when) ? null : Math.max(0, when - Date.now());
}

/** Exponential backoff with full jitter, capped. attempt is 0-based. */
function backoffDelay(attempt, baseDelayMs) {
  const ceiling = Math.min(MAX_BACKOFF_MS, baseDelayMs * 2 ** attempt);
  return Math.round(Math.random() * ceiling);
}

/**
 * Fetch a URL, retrying transient failures (429 / 5xx / network errors) with exponential
 * backoff + jitter. Honors a server-sent Retry-After. Non-retryable responses (e.g. 404)
 * are returned as-is for the caller to handle.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetchImpl=fetch]
 * @param {number} [opts.retries=3]          max retry attempts after the first try
 * @param {number} [opts.baseDelayMs=1000]   backoff base
 * @param {(ms:number)=>Promise<void>} [opts.sleepImpl] injectable sleep (tests)
 * @param {(info:{attempt:number,reason:string,waitMs:number})=>void} [opts.onRetry]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, opts = {}) {
  const {
    fetchImpl = fetch,
    retries = DEFAULT_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    sleepImpl = defaultSleep,
    onRetry,
  } = opts;

  for (let attempt = 0; ; attempt++) {
    let resp;
    try {
      resp = await fetchImpl(url, { headers: REQUEST_HEADERS });
    } catch (err) {
      // Network-level failure (DNS, reset, timeout): retry until exhausted, then rethrow.
      if (attempt >= retries) throw err;
      const waitMs = backoffDelay(attempt, baseDelayMs);
      onRetry?.({ attempt, reason: err.message, waitMs });
      await sleepImpl(waitMs);
      continue;
    }

    if (RETRYABLE_STATUS.has(resp.status) && attempt < retries) {
      const retryAfter = parseRetryAfter(resp.headers?.get?.('retry-after'));
      const waitMs = retryAfter ?? backoffDelay(attempt, baseDelayMs);
      onRetry?.({ attempt, reason: `HTTP ${resp.status}`, waitMs });
      await sleepImpl(waitMs);
      continue;
    }

    return resp;
  }
}

/**
 * Fetch a law page and extract its current revision date.
 * Accepts the same opts as fetchWithRetry (retries / backoff / sleepImpl / onRetry),
 * plus `fetchImpl` for tests.
 *
 * @param {string} url
 * @param {object} [opts]
 * @returns {Promise<string|null>} ISO date or null if it could not be parsed
 */
export async function fetchRevisionDate(url, opts = {}) {
  const mainUrl = toMainPageUrl(url);
  const resp = await fetchWithRetry(mainUrl, opts);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${mainUrl}`);
  }
  return extractRevisionDate(await resp.text());
}
