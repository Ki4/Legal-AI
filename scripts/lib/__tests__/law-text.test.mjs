import { describe, it, expect } from 'vitest';
import { htmlToText, extractArticles, fetchLawText } from '../law-text.mjs';

describe('htmlToText', () => {
  it('strips tags, decodes entities, and turns block tags into newlines', () => {
    const html = '<div>Стаття 1.&nbsp;Текст</div><p>Другий &laquo;абзац&raquo;</p>';
    const text = htmlToText(html);
    expect(text).toContain('Стаття 1. Текст');
    expect(text).toContain('Другий «абзац»');
    expect(text).toContain('\n'); // block boundary became a newline
    expect(text).not.toContain('<'); // no tags left
  });

  it('drops script/style content', () => {
    expect(htmlToText('<style>.x{}</style><script>bad()</script><p>текст</p>')).toBe('текст');
  });

  it('returns empty string for non-string input', () => {
    expect(htmlToText(null)).toBe('');
    expect(htmlToText(undefined)).toBe('');
    expect(htmlToText(42)).toBe('');
  });

  it('decodes numeric character references', () => {
    // &#1057; = "С", &#8212; = em dash
    expect(htmlToText('<p>&#1057;тигма &#8212; кінець</p>')).toBe('Стигма — кінець');
  });

  it('turns <br> and list/table block tags into newlines', () => {
    const out = htmlToText('<li>один</li><li>два</li>рядок<br>далі<tr>клітинка</tr>');
    expect(out.split('\n').length).toBeGreaterThan(1);
    expect(out).toContain('один');
    expect(out).toContain('два');
  });

  it('collapses runs of inline whitespace and trims', () => {
    expect(htmlToText('  <p>  багато     пробілів  </p>  ')).toBe('багато пробілів');
  });
});

describe('extractArticles', () => {
  it('splits text into a number → article map by "Стаття N" headers', () => {
    const text = 'Преамбула\nСтаття 182. Перша.\nрядок\nСтаття 184. Друга.';
    const arts = extractArticles(text);
    expect(Object.keys(arts)).toEqual(['182', '184']);
    expect(arts['182']).toContain('Перша.');
    expect(arts['182']).toContain('рядок');
    expect(arts['184']).toContain('Друга.');
  });

  it('handles hyphenated article numbers (e.g. 182-1)', () => {
    const arts = extractArticles('Стаття 182-1. Спеціальна.');
    expect(Object.keys(arts)).toEqual(['182-1']);
  });

  it('returns {} when there are no article headers (caller falls back to law-level diff)', () => {
    expect(extractArticles('просто текст без заголовків статей')).toEqual({});
  });

  it('keeps preamble text out of the article map (only post-header text is captured)', () => {
    const text = 'Преамбула без статті\nСтаття 1. Тіло першої.';
    const arts = extractArticles(text);
    expect(Object.keys(arts)).toEqual(['1']);
    expect(arts['1']).not.toContain('Преамбула');
    expect(arts['1']).toContain('Тіло першої');
  });

  it('returns {} for non-string input', () => {
    expect(extractArticles(null)).toEqual({});
    expect(extractArticles(undefined)).toEqual({});
    expect(extractArticles(123)).toEqual({});
  });

  it('captures an article body that runs to end of text (last header)', () => {
    const arts = extractArticles('Стаття 5. Перша.\nСтаття 6. Остання до кінця.');
    expect(arts['6']).toContain('Остання до кінця');
  });

  it('only treats a header at line start (an inline "Стаття N" mid-line is not a split point)', () => {
    // "див. Стаття 7" sits mid-line → not a header; "Стаття 1." at line start is.
    const arts = extractArticles('Стаття 1. Текст з посиланням див. Стаття 7 в кінці.');
    expect(Object.keys(arts)).toEqual(['1']);
    expect(arts['1']).toContain('Стаття 7');
  });
});

describe('fetchLawText', () => {
  const fakeResp = (body, ok = true, status = 200) => ({
    ok, status, headers: { get: () => null }, text: async () => body,
  });

  it('fetches the page and returns its plain text', async () => {
    const text = await fetchLawText('https://zakon.rada.gov.ua/laws/show/2947-14', {
      fetchImpl: async () => fakeResp('<p>Стаття 1. Тіло</p>'),
    });
    expect(text).toContain('Стаття 1. Тіло');
  });

  it('throws on a non-ok response', async () => {
    await expect(
      fetchLawText('https://zakon.rada.gov.ua/laws/show/2947-14', {
        fetchImpl: async () => fakeResp('nope', false, 404),
        retries: 0,
      }),
    ).rejects.toThrow(/HTTP 404/);
  });
});
