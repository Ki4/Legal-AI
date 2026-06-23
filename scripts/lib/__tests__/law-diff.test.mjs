import { describe, it, expect } from 'vitest';
import { diffLines, buildArticleDiffs } from '../law-diff.mjs';

const FIXED = () => '2026-06-23T12:00:00.000Z';

describe('diffLines', () => {
  it('marks identical input as all "same"', () => {
    const { ops } = diffLines(['a', 'b'], ['a', 'b']);
    expect(ops.every((o) => o.op === 'same')).toBe(true);
  });

  it('captures a changed line as remove + add', () => {
    const { ops } = diffLines(['a', 'old', 'c'], ['a', 'new', 'c']);
    expect(ops.find((o) => o.op === 'remove')?.line).toBe('old');
    expect(ops.find((o) => o.op === 'add')?.line).toBe('new');
  });
});

describe('buildArticleDiffs — per-article', () => {
  it('reports only the changed article, as op "changed"', () => {
    const oldText = 'Стаття 182. Старий текст.\nСпільний рядок.\nСтаття 184. Незмінна.';
    const newText = 'Стаття 182. Новий текст.\nСпільний рядок.\nСтаття 184. Незмінна.';
    const d = buildArticleDiffs({ oldText, newText, lawCode: '2947-14', sourceUrl: 'u', now: FIXED });
    expect(d.level).toBe('article');
    expect(d.changed_articles).toEqual(['182']);
    expect(d.hunks).toHaveLength(1);
    expect(d.hunks[0]).toMatchObject({ article_num: '182', op: 'changed' });
    expect(d.hunks[0].removed.join(' ')).toContain('Старий');
    expect(d.hunks[0].added.join(' ')).toContain('Новий');
    expect(d.captured_at).toBe('2026-06-23T12:00:00.000Z');
    expect(d.truncated).toBe(false);
  });

  it('flags a newly added article as op "added"', () => {
    const oldText = 'Стаття 182. Текст.';
    const newText = 'Стаття 182. Текст.\nСтаття 200. Нова стаття.';
    const d = buildArticleDiffs({ oldText, newText, now: FIXED });
    expect(d.changed_articles).toEqual(['200']);
    expect(d.hunks[0]).toMatchObject({ article_num: '200', op: 'added' });
  });

  it('returns no hunks when the texts are identical', () => {
    const text = 'Стаття 182. Текст.';
    const d = buildArticleDiffs({ oldText: text, newText: text, now: FIXED });
    expect(d.hunks).toEqual([]);
    expect(d.changed_articles).toEqual([]);
  });
});

describe('buildArticleDiffs — law-level fallback', () => {
  it('diffs whole text when there are no article headers', () => {
    const d = buildArticleDiffs({
      oldText: 'просто текст без заголовків',
      newText: 'просто текст без заголовків змінений',
      now: FIXED,
    });
    expect(d.level).toBe('law');
    expect(d.hunks[0].article_num).toBeNull();
    expect(d.changed_articles).toEqual([]);
  });
});

describe('buildArticleDiffs — storage cap', () => {
  it('sets truncated=true when the diff exceeds the byte cap', () => {
    // ~3000 distinct added lines (no article headers) → one huge law-level hunk → truncated.
    const newText = Array.from({ length: 3000 }, (_, i) => `рядок номер ${i} з деяким текстом`).join('\n');
    const d = buildArticleDiffs({ oldText: '', newText, now: FIXED });
    expect(d.truncated).toBe(true);
  });
});
