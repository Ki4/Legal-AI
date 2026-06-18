import { describe, it, expect } from 'vitest';
import { affectedServices, applyLawChange } from '../law-change.mjs';
import { lawCode } from '../../law-registry.mjs';

const FAMILY_CODE = {
  slug: 'simeinyi-kodeks',
  title: 'Сімейний кодекс України',
  url: 'https://zakon.rada.gov.ua/laws/show/2947-14',
};

function makeServices() {
  return [
    {
      id: 1,
      slug: 'divorce',
      status: 'active',
      watched_laws: [
        { slug: 'simeinyi-kodeks', url: 'https://zakon.rada.gov.ua/laws/show/2947-14', last_known_date: '2025-01-01' },
        { slug: 'pro-sudovyi-zbir', url: 'https://zakon.rada.gov.ua/laws/show/3674-17', last_known_date: '2024-06-01' },
      ],
    },
    {
      id: 2,
      slug: 'alimony',
      status: 'active',
      // Same law via a DRIFTED slug but the SAME url — must still be matched.
      watched_laws: [
        { slug: 'simejnyj-kodeks', url: 'https://zakon.rada.gov.ua/laws/show/2947-14/', last_known_date: '2025-01-01' },
      ],
    },
    {
      id: 3,
      slug: 'military',
      status: 'disabled',
      watched_laws: [],
    },
  ];
}

/** In-memory Supabase client double recording inserts and patches. */
function mockClient(services) {
  const inserts = [];
  const patches = [];
  let nextId = 100;
  return {
    inserts,
    patches,
    client: {
      sbGet: async () => services,
      sbInsert: async (_table, row) => {
        const saved = { id: nextId++, ...row };
        inserts.push(saved);
        return [saved];
      },
      sbPatch: async (table, query, body) => {
        patches.push({ table, query, body });
        return [body];
      },
    },
  };
}

describe('lawCode', () => {
  it('derives the rada doc-id from the canonical URL', () => {
    expect(lawCode(FAMILY_CODE)).toBe('2947-14');
  });

  it('is insensitive to a trailing slash', () => {
    expect(lawCode({ url: 'https://zakon.rada.gov.ua/laws/show/2947-14/' })).toBe('2947-14');
  });
});

describe('affectedServices', () => {
  it('matches by canonical URL across slug drift and trailing-slash differences', () => {
    const hits = affectedServices(makeServices(), FAMILY_CODE).map((s) => s.slug);
    expect(hits).toEqual(['divorce', 'alimony']);
  });

  it('returns [] for a law no service watches', () => {
    const other = { slug: 'x', title: 'X', url: 'https://zakon.rada.gov.ua/laws/show/0000-00' };
    expect(affectedServices(makeServices(), other)).toEqual([]);
  });
});

describe('applyLawChange (dry run)', () => {
  it('reports affected services and derived old date without writing', async () => {
    const { client, inserts, patches } = mockClient(makeServices());
    const res = await applyLawChange(client, { law: FAMILY_CODE, newDate: '2026-03-04', dry: true });
    expect(res.affected.map((s) => s.slug)).toEqual(['divorce', 'alimony']);
    expect(res.derivedOld).toBe('2025-01-01');
    expect(res.logRow).toBeNull();
    expect(inserts).toHaveLength(0);
    expect(patches).toHaveLength(0);
  });
});

describe('applyLawChange (live)', () => {
  it('inserts one cron audit row and flips each dependent service to needs_review', async () => {
    const { client, inserts, patches } = mockClient(makeServices());
    const res = await applyLawChange(client, {
      law: FAMILY_CODE,
      newDate: '2026-03-04',
      detectedBy: 'cron',
      notes: 'auto',
    });

    // One audit row, flagged, scoped to both dependent services.
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      law_slug: 'simeinyi-kodeks',
      old_revision_date: '2025-01-01',
      new_revision_date: '2026-03-04',
      detected_by: 'cron',
      action: 'flagged',
      affected_services: ['divorce', 'alimony'],
    });

    // Both dependent services flipped; the OTHER law's date is left untouched.
    const servicePatches = patches.filter((p) => p.table === 'services');
    expect(servicePatches).toHaveLength(2);
    for (const p of servicePatches) {
      expect(p.body.status).toBe('needs_review');
      expect(p.body.needs_law_review).toBe(true);
    }
    const divorcePatch = servicePatches.find((p) => p.query === 'id=eq.1');
    const familyEntry = divorcePatch.body.watched_laws.find((l) => l.url.includes('2947-14'));
    const courtFeeEntry = divorcePatch.body.watched_laws.find((l) => l.url.includes('3674-17'));
    expect(familyEntry.last_known_date).toBe('2026-03-04'); // bumped
    expect(courtFeeEntry.last_known_date).toBe('2024-06-01'); // untouched
    expect(res.logRow.id).toBeGreaterThan(0);

    // RAG content for the changed law is marked stale, by law_code (not by service).
    const chunkPatch = patches.find((p) => p.table === 'law_chunks');
    const docPatch = patches.find((p) => p.table === 'law_documents');
    expect(chunkPatch).toMatchObject({ query: 'law_code=eq.2947-14', body: { is_stale: true } });
    expect(docPatch).toMatchObject({ query: 'law_code=eq.2947-14', body: { is_stale: true } });
  });

  it('honors an explicit oldDate override', async () => {
    const { client, inserts } = mockClient(makeServices());
    await applyLawChange(client, { law: FAMILY_CODE, newDate: '2026-03-04', oldDate: '2020-01-01' });
    expect(inserts[0].old_revision_date).toBe('2020-01-01');
  });

  it('still logs and marks RAG content stale when no service depends on the law', async () => {
    const { client, inserts, patches } = mockClient(makeServices());
    const orphan = { slug: 'orphan', title: 'Orphan', url: 'https://zakon.rada.gov.ua/laws/show/9999-99' };
    const res = await applyLawChange(client, { law: orphan, newDate: '2026-03-04' });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].affected_services).toEqual([]);
    expect(patches.filter((p) => p.table === 'services')).toHaveLength(0);
    expect(res.affected).toEqual([]);

    // Staleness is keyed on law_code, not on service dependents.
    expect(lawCode(orphan)).toBe('9999-99');
    const chunkPatch = patches.find((p) => p.table === 'law_chunks');
    const docPatch = patches.find((p) => p.table === 'law_documents');
    expect(chunkPatch).toMatchObject({ query: 'law_code=eq.9999-99', body: { is_stale: true } });
    expect(docPatch).toMatchObject({ query: 'law_code=eq.9999-99', body: { is_stale: true } });
  });
});
