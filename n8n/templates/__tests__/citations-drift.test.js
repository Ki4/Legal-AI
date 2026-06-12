import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractArticlesByLaw } from '../../../scripts/lib/citations.mjs';
import { SERVICES_DIR, listTemplateSlugs } from '../../../scripts/extract-citations.mjs';

/**
 * Drift guard (issue #36, G2): `<slug>.citations.json` is the committed SSoT for
 * "service → cited law articles". If a template's citations change (new/removed
 * article references), this test fails until the golden is regenerated via:
 *
 *   node scripts/extract-citations.mjs --write
 *
 * Do not "fix" by blindly re-running --write — review the diff first. A change here
 * means the legal basis of a document changed and may need watched_laws / Olga's review.
 */
describe('citation goldens match templates', () => {
  for (const slug of listTemplateSlugs()) {
    it(`${slug}.citations.json matches ${slug}.document.txt`, () => {
      const template = readFileSync(resolve(SERVICES_DIR, `${slug}.document.txt`), 'utf8');
      const golden = JSON.parse(readFileSync(resolve(SERVICES_DIR, `${slug}.citations.json`), 'utf8'));

      expect(golden).toEqual({ slug, laws: extractArticlesByLaw(template) });
    });
  }

  it('every template has a golden', () => {
    expect(listTemplateSlugs().length).toBeGreaterThan(0);
  });
});
