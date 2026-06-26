import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractCitations, extractArticlesByLaw, expandArticleList } from '../citations.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../../../n8n/templates/services');

const SK_URL = 'https://zakon.rada.gov.ua/laws/show/2947-14';
const CPK_URL = 'https://zakon.rada.gov.ua/laws/show/1618-15';
const ZSZ_URL = 'https://zakon.rada.gov.ua/laws/show/3674-17';

describe('expandArticleList', () => {
  it('expands a comma-separated list of single articles', () => {
    expect(expandArticleList('105, 110, 112')).toEqual(['105', '110', '112']);
  });

  it('expands an en-dash range mixed with a single article', () => {
    expect(expandArticleList('150, 180–184')).toEqual(['150', '180', '181', '182', '183', '184']);
  });

  it('expands a hyphen range', () => {
    expect(expandArticleList('182-184')).toEqual(['182', '183', '184']);
  });

  it('passes through a single article unchanged', () => {
    expect(expandArticleList('27')).toEqual(['27']);
  });
});

describe('extractCitations', () => {
  it('extracts a simple "ст.N <law>" citation', () => {
    const citations = extractCitations('Відповідно до ст.112 Сімейного кодексу України суд постановляє рішення.');
    expect(citations).toHaveLength(1);
    expect(citations[0].law.url).toBe(SK_URL);
    expect(citations[0].articles).toEqual(['112']);
  });

  it('extracts "ч.N ст.M <law>" with part captured', () => {
    const citations = extractCitations('Відповідно до ч.3 ст.105 СК України шлюб припиняється.');
    expect(citations).toHaveLength(1);
    expect(citations[0].law.url).toBe(SK_URL);
    expect(citations[0].articles).toEqual(['105']);
    expect(citations[0].part).toBe('3');
  });

  it('extracts "п.N ч.M ст.K <law>" with point and part captured', () => {
    const citations = extractCitations('Згідно з п.6 ч.3 ст.175 ЦПК України повідомляю.');
    expect(citations).toHaveLength(1);
    expect(citations[0].law.url).toBe(CPK_URL);
    expect(citations[0].articles).toEqual(['175']);
    expect(citations[0].point).toBe('6');
    expect(citations[0].part).toBe('3');
  });

  it('extracts "пп.N п.M ч.K ст.L <law>" with subpoint, point and part captured', () => {
    const citations = extractCitations('на підставі пп.3 п.1 ч.2 ст.4 Закону України «Про судовий збір».');
    expect(citations).toHaveLength(1);
    expect(citations[0].law.url).toBe(ZSZ_URL);
    expect(citations[0].articles).toEqual(['4']);
    expect(citations[0].subpoint).toBe('3');
    expect(citations[0].point).toBe('1');
    expect(citations[0].part).toBe('2');
  });

  it('extracts a "ст.ст." multi-article citation', () => {
    const citations = extractCitations('керуючись ст.ст.105, 110, 112 Сімейного Кодексу України,—');
    expect(citations).toHaveLength(1);
    expect(citations[0].law.url).toBe(SK_URL);
    expect(citations[0].articles).toEqual(['105', '110', '112']);
  });

  it('extracts a "ст.ст." multi-article citation with an en-dash range', () => {
    const citations = extractCitations('у відповідності до ст.ст. 150, 180–184 СК України, керуючись');
    expect(citations).toHaveLength(1);
    expect(citations[0].law.url).toBe(SK_URL);
    expect(citations[0].articles).toEqual(['150', '180', '181', '182', '183', '184']);
  });

  it('extracts a "<law> (ст. N-M)" citation with the law name first', () => {
    const citations = extractCitations('відповідно до вимог Сімейного кодексу України (ст. 182-184), вирішуючи питання');
    expect(citations).toHaveLength(1);
    expect(citations[0].law.url).toBe(SK_URL);
    expect(citations[0].articles).toEqual(['182', '183', '184']);
  });

  it('resolves the {{#if}}/{{else if}}/{{else}} court-fee-exemption chain to a single citation', () => {
    // Reproduces n8n/templates/services/divorce.document.txt line 162 verbatim:
    // each branch's "п.N ч.1 ст.5" is immediately followed by the next branch's
    // citation text (no filler), so only the last branch — followed by the
    // ________ placeholder and the law name — completes a match.
    const text =
      "Від сплати судового збору {{gender plaintiff_gender 'звільнений' 'звільнена'}} на підставі " +
      "{{#if court_fee_exempt_reason == 'disability_1_2'}}п.1 ч.1 ст.5" +
      "{{else if court_fee_exempt_reason == 'child_disability'}}п.2 ч.1 ст.5" +
      "{{else if court_fee_exempt_reason == 'chornobyl'}}п.11 ч.1 ст.5" +
      "{{else}}________{{/if}} Закону України «Про судовий збір» у зв'язку з наявністю статусу.";

    const citations = extractCitations(text);
    expect(citations).toHaveLength(1);
    expect(citations[0].law.url).toBe(ZSZ_URL);
    expect(citations[0].articles).toEqual(['5']);
    expect(citations[0].point).toBe('11');
    expect(citations[0].part).toBe('1');
  });

  it('returns an empty array for text without citations', () => {
    expect(extractCitations('Позивач: {{plaintiff_name}}')).toEqual([]);
  });
});

describe('extractArticlesByLaw', () => {
  it('groups, dedupes and sorts articles per law, ordered SK → ЦПК → ЗСЗ', () => {
    const text = [
      'ст.112 Сімейного кодексу України',
      'ч.3 ст.105 СК України',
      'ст.110 СК України',
      'ст.27 ЦПК України',
    ].join(' ');

    expect(extractArticlesByLaw(text)).toEqual([
      { url: SK_URL, slug: 'simeinyi-kodeks', title: expect.any(String), articles: ['105', '110', '112'] },
      { url: CPK_URL, slug: 'tsyvilnyi-protsesualnyi-kodeks', title: expect.any(String), articles: ['27'] },
    ]);
  });

  it('matches the real divorce template: SK={105,110,112,157}, ЦПК={27,175,187,274}, ЗСЗ={4,5}', () => {
    // ст.65 СК dropped in #67 (Variant B): debt division deferred to a separate suit.
    const text = readFileSync(resolve(TEMPLATES_DIR, 'divorce.document.txt'), 'utf8');
    const byLaw = extractArticlesByLaw(text);

    expect(byLaw.find((l) => l.url === SK_URL).articles).toEqual(['105', '110', '112', '157']);
    expect(byLaw.find((l) => l.url === CPK_URL).articles).toEqual(['27', '175', '187', '274']);
    expect(byLaw.find((l) => l.url === ZSZ_URL).articles).toEqual(['4', '5']);
  });

  it('matches the real alimony template: SK={141,150,180-184}, ЦПК={174,175}, ЗСЗ={5}', () => {
    const text = readFileSync(resolve(TEMPLATES_DIR, 'alimony.document.txt'), 'utf8');
    const byLaw = extractArticlesByLaw(text);

    expect(byLaw.find((l) => l.url === SK_URL).articles).toEqual(['141', '150', '180', '181', '182', '183', '184']);
    expect(byLaw.find((l) => l.url === CPK_URL).articles).toEqual(['174', '175']);
    expect(byLaw.find((l) => l.url === ZSZ_URL).articles).toEqual(['5']);
  });
});
