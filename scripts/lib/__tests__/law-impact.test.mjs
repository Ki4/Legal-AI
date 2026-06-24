import { describe, it, expect } from 'vitest';
import { captureLawDiff } from '../law-impact.mjs';

const FAMILY = {
  slug: 'simeinyi-kodeks',
  title: 'Сімейний кодекс України',
  url: 'https://zakon.rada.gov.ua/laws/show/2947-14',
};

describe('captureLawDiff', () => {
  it('diffs stored old text (law_documents) against freshly fetched new text', async () => {
    const client = { sbGet: async () => [{ full_text: 'Стаття 182. Старий.' }] };
    const d = await captureLawDiff(client, FAMILY, {
      fetchText: async () => 'Стаття 182. Новий.',
      now: () => '2026-06-23T12:00:00.000Z',
    });
    expect(d.law_code).toBe('2947-14');
    expect(d.source_url).toBe(FAMILY.url);
    expect(d.changed_articles).toEqual(['182']);
    expect(d.hunks[0].op).toBe('changed');
  });

  it('returns null when the law URL yields no law_code', async () => {
    const client = { sbGet: async () => [] };
    expect(await captureLawDiff({ url: '' }, { url: '' }, { fetchText: async () => 'x' })).toBeNull();
  });

  it('returns null when both old and new text are empty', async () => {
    const client = { sbGet: async () => [] };
    expect(await captureLawDiff(client, FAMILY, { fetchText: async () => '' })).toBeNull();
  });

  it('is fail-soft: a fetch error degrades to null (monitor proceeds without a diff)', async () => {
    const client = { sbGet: async () => [] };
    const d = await captureLawDiff(client, FAMILY, {
      fetchText: async () => { throw new Error('network'); },
    });
    expect(d).toBeNull();
  });

  it('is fail-soft when the DB read throws (treats old text as empty)', async () => {
    const client = { sbGet: async () => { throw new Error('db down'); } };
    const d = await captureLawDiff(client, FAMILY, {
      fetchText: async () => 'Стаття 182. Новий.',
      now: () => '2026-06-23T12:00:00.000Z',
    });
    // old empty + new present → a diff that adds the new content (not null).
    expect(d).not.toBeNull();
    expect(d.law_code).toBe('2947-14');
  });

  it('produces a diff from stored old text even when the new fetch yields empty', async () => {
    const client = { sbGet: async () => [{ full_text: 'Стаття 182. Старий.' }] };
    const d = await captureLawDiff(client, FAMILY, {
      fetchText: async () => '',
      now: () => '2026-06-23T12:00:00.000Z',
    });
    expect(d).not.toBeNull();
    // old has an article header, new is empty → law-level diff (no both-sides article split).
    expect(d.level).toBe('law');
  });

  it('tolerates an empty rows array from the DB (no [0] row)', async () => {
    const client = { sbGet: async () => [] };
    const d = await captureLawDiff(client, FAMILY, {
      fetchText: async () => 'Стаття 182. Новий.',
      now: () => '2026-06-23T12:00:00.000Z',
    });
    expect(d.source_url).toBe(FAMILY.url);
  });
});
