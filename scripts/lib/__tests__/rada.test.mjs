import { describe, it, expect } from 'vitest';
import {
  extractRevisionDate,
  toMainPageUrl,
  fetchRevisionDate,
  fetchWithRetry,
  parseRetryAfter,
} from '../rada.mjs';

/** Build a fake Response with a Headers-like .headers.get(). */
function res({ ok = true, status = 200, body = '', headers = {} } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { ok, status, headers: { get: (k) => lower[k.toLowerCase()] ?? null }, text: async () => body };
}

const noSleep = async () => {};

describe('extractRevisionDate', () => {
  it('parses "Редакція від DD.MM.YYYY" (capitalized)', () => {
    expect(extractRevisionDate('<h1>Сімейний кодекс</h1>Редакція від 04.03.2026, підстава')).toBe('2026-03-04');
  });

  it('parses lowercase "редакція від"', () => {
    expect(extractRevisionDate('поточна редакція від 01.01.2024')).toBe('2024-01-01');
  });

  it('falls back to "станом на DD.MM.YYYY"', () => {
    expect(extractRevisionDate('<div>Документ станом на 15.12.2025</div>')).toBe('2025-12-15');
  });

  it('prefers the revision date over an earlier adoption date in the markup', () => {
    const html = 'Прийнято від 10.01.2002 ... Редакція від 04.03.2026 ...';
    expect(extractRevisionDate(html)).toBe('2026-03-04');
  });

  it('does NOT match a bare "від DD.MM.YYYY" (adoption date trap)', () => {
    expect(extractRevisionDate('Закон від 10.01.2002 № 2947-III')).toBeNull();
  });

  it('returns null when no date is present', () => {
    expect(extractRevisionDate('<html>no dates here</html>')).toBeNull();
  });

  it('returns null on empty / non-string input', () => {
    expect(extractRevisionDate('')).toBeNull();
    expect(extractRevisionDate(null)).toBeNull();
    expect(extractRevisionDate(undefined)).toBeNull();
  });
});

describe('toMainPageUrl', () => {
  it('strips a trailing /print', () => {
    expect(toMainPageUrl('https://zakon.rada.gov.ua/laws/show/2947-14/print')).toBe(
      'https://zakon.rada.gov.ua/laws/show/2947-14',
    );
  });

  it('strips a trailing slash', () => {
    expect(toMainPageUrl('https://zakon.rada.gov.ua/laws/show/2947-14/')).toBe(
      'https://zakon.rada.gov.ua/laws/show/2947-14',
    );
  });

  it('leaves a clean URL untouched', () => {
    expect(toMainPageUrl('https://zakon.rada.gov.ua/laws/show/2947-14')).toBe(
      'https://zakon.rada.gov.ua/laws/show/2947-14',
    );
  });
});

describe('parseRetryAfter', () => {
  it('parses delta-seconds', () => {
    expect(parseRetryAfter('120')).toBe(120_000);
  });
  it('parses an HTTP-date into a future delay', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfter(future);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });
  it('returns null for absent / unparseable values', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});

describe('fetchWithRetry', () => {
  it('retries transient 503 then succeeds, returning the final response', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return calls < 3 ? res({ ok: false, status: 503 }) : res({ ok: true, body: 'done' });
    };
    const r = await fetchWithRetry('u', { fetchImpl, sleepImpl: noSleep });
    expect(calls).toBe(3);
    expect(await r.text()).toBe('done');
  });

  it('honors Retry-After (delta-seconds) for the wait duration', async () => {
    let calls = 0;
    const waits = [];
    const fetchImpl = async () => (++calls === 1 ? res({ ok: false, status: 429, headers: { 'Retry-After': '7' } }) : res({ ok: true }));
    await fetchWithRetry('u', { fetchImpl, sleepImpl: async (ms) => waits.push(ms), onRetry: () => {} });
    expect(waits).toEqual([7000]);
  });

  it('retries network errors then rethrows after exhausting retries', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      throw new Error('ECONNRESET');
    };
    await expect(fetchWithRetry('u', { fetchImpl, retries: 2, sleepImpl: noSleep })).rejects.toThrow(/ECONNRESET/);
    expect(calls).toBe(3); // first try + 2 retries
  });

  it('does NOT retry a non-retryable status (404) — returns immediately', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return res({ ok: false, status: 404 });
    };
    const r = await fetchWithRetry('u', { fetchImpl, sleepImpl: noSleep });
    expect(calls).toBe(1);
    expect(r.status).toBe(404);
  });
});

describe('fetchRevisionDate', () => {
  it('uses the main page URL and returns the parsed date', async () => {
    let requested;
    const fetchImpl = async (url) => {
      requested = url;
      return res({ ok: true, body: 'Редакція від 04.03.2026' });
    };
    const date = await fetchRevisionDate('https://zakon.rada.gov.ua/laws/show/2947-14/print', { fetchImpl, sleepImpl: noSleep });
    expect(requested).toBe('https://zakon.rada.gov.ua/laws/show/2947-14');
    expect(date).toBe('2026-03-04');
  });

  it('throws on a non-retryable non-ok HTTP response', async () => {
    const fetchImpl = async () => res({ ok: false, status: 404 });
    await expect(fetchRevisionDate('https://zakon.rada.gov.ua/laws/show/2947-14', { fetchImpl, sleepImpl: noSleep })).rejects.toThrow(/HTTP 404/);
  });

  it('throws after exhausting retries on persistent 503', async () => {
    const fetchImpl = async () => res({ ok: false, status: 503 });
    await expect(
      fetchRevisionDate('https://zakon.rada.gov.ua/laws/show/2947-14', { fetchImpl, retries: 2, sleepImpl: noSleep }),
    ).rejects.toThrow(/HTTP 503/);
  });

  it('returns null when the page has no recognizable date', async () => {
    const fetchImpl = async () => res({ ok: true, body: '<html>nothing</html>' });
    expect(await fetchRevisionDate('https://zakon.rada.gov.ua/laws/show/2947-14', { fetchImpl, sleepImpl: noSleep })).toBeNull();
  });
});
