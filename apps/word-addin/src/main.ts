/**
 * Spike: answer, by running it in a real Word, what the add-in can actually do.
 *
 * Every button here maps to one unknown from docs/architecture/word-addin-feasibility-2026-07-15.md.
 * This is throwaway code — it proves mechanics, not UX. The measurable outcome lives elsewhere:
 * after this pane has written to torture-poc.docx and Word has saved it, `pytest apps/doc-engine`
 * must still be green. If it isn't, Word's round-trip destroyed something.
 */

/** The namespace docx_meta.py writes and recognises the blob by. Must match exactly. */
const NS = 'urn:legal-ai:service-meta:1';
const ROOT_TAG = 'serviceMeta';

const logEl = document.getElementById('log') as HTMLElement;
let first = true;

function log(msg: string, cls: 'ok' | 'bad' | 'note' | '' = '') {
  if (first) {
    logEl.textContent = '';
    first = false;
  }
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function fail(where: string, e: unknown) {
  const err = e as { message?: string; debugInfo?: unknown };
  log(`✗ ${where}: ${err?.message ?? String(e)}`, 'bad');
  if (err?.debugInfo) log(`  debug: ${JSON.stringify(err.debugInfo)}`, 'bad');
}

function on(id: string, fn: () => Promise<void>) {
  document.getElementById(id)!.addEventListener('click', () => {
    fn().catch((e) => fail(id, e));
  });
}

// ── customXml plumbing ───────────────────────────────────────────────────────

/** Our part, found the same way the future compiler finds it: by namespace. */
function getOurPart(): Promise<Office.CustomXmlPart | null> {
  return new Promise((resolve, reject) => {
    Office.context.document.customXmlParts.getByNamespaceAsync(NS, (r) => {
      if (r.status !== Office.AsyncResultStatus.Succeeded) return reject(r.error);
      resolve(r.value.length ? r.value[0] : null);
    });
  });
}

function getXml(part: Office.CustomXmlPart): Promise<string> {
  return new Promise((resolve, reject) => {
    part.getXmlAsync((r) => {
      if (r.status !== Office.AsyncResultStatus.Succeeded) return reject(r.error);
      resolve(r.value);
    });
  });
}

function addPart(xml: string): Promise<Office.CustomXmlPart> {
  return new Promise((resolve, reject) => {
    Office.context.document.customXmlParts.addAsync(xml, (r) => {
      if (r.status !== Office.AsyncResultStatus.Succeeded) return reject(r.error);
      resolve(r.value);
    });
  });
}

function deletePart(part: Office.CustomXmlPart): Promise<void> {
  return new Promise((resolve, reject) => {
    part.deleteAsync((r) => {
      if (r.status !== Office.AsyncResultStatus.Succeeded) return reject(r.error);
      resolve();
    });
  });
}

/**
 * Pull the JSON payload out of the part.
 * docx_meta.py wraps it in CDATA. Whether Word PRESERVES the CDATA or re-serialises it as
 * escaped text is the single scariest unknown here — the Python reader looks for '<![CDATA['.
 * So: try CDATA, then fall back to the parsed text content, and REPORT which one it was.
 */
function payloadOf(xml: string): { json: unknown; form: 'cdata' | 'escaped' | 'unknown' } {
  const start = xml.indexOf('<![CDATA[');
  const end = xml.lastIndexOf(']]>');
  if (start !== -1 && end !== -1) {
    const raw = xml.slice(start + 9, end).replace(/]]]]><!\[CDATA\[>/g, ']]>');
    return { json: JSON.parse(raw), form: 'cdata' };
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const text = doc.documentElement?.textContent ?? '';
  try {
    return { json: JSON.parse(text), form: 'escaped' };
  } catch {
    return { json: null, form: 'unknown' };
  }
}

/** Rebuild the part XML exactly as docx_meta.py would — same escape, same namespace. */
function partXml(meta: unknown): string {
  const payload = JSON.stringify(meta, null, 1).replace(/]]>/g, ']]]]><![CDATA[>');
  return `<${ROOT_TAG} xmlns="${NS}"><![CDATA[${payload}]]></${ROOT_TAG}>`;
}

async function readMeta(): Promise<{ meta: any; form: string; xml: string } | null> {
  const part = await getOurPart();
  if (!part) {
    log('✗ блоб не знайдено — цей .docx не розмічений (або namespace не збігся)', 'bad');
    return null;
  }
  const xml = await getXml(part);
  const { json, form } = payloadOf(xml);
  return { meta: json, form, xml };
}

// ── 1. environment ───────────────────────────────────────────────────────────

on('probe', async () => {
  const req = Office.context.requirements;
  log(`host=${Office.context.host} platform=${Office.context.platform}`);
  log(`Office version: ${Office.context.diagnostics?.version ?? 'n/a'}`);
  for (const v of ['1.1', '1.2', '1.3', '1.4', '1.5']) {
    log(`WordApi ${v}: ${req.isSetSupported('WordApi', v) ? 'YES' : 'no'}`,
      req.isSetSupported('WordApi', v) ? 'ok' : 'note');
  }
  const cx = req.isSetSupported('CustomXmlParts');
  log(`CustomXmlParts: ${cx ? 'YES' : 'NO'}`, cx ? 'ok' : 'bad');
});

// ── 2. the blob ──────────────────────────────────────────────────────────────

on('read', async () => {
  const r = await readMeta();
  if (!r) return;
  log(`✓ блоб знайдено за namespace`, 'ok');
  log(`  payload form: ${r.form}${r.form === 'escaped' ? '  ← CDATA НЕ вцілів!' : ''}`,
    r.form === 'cdata' ? 'ok' : 'bad');
  log(`  slug: ${r.meta?.service?.slug}`);
  log(`  title: ${r.meta?.service?.title}`);
  log(`  tabs: ${r.meta?.tabs?.length}, fields: ${r.meta?.fields?.length}`);
  log(`  raw (перші 160): ${r.xml.slice(0, 160)}`);
});

on('rewrite', async () => {
  const r = await readMeta();
  if (!r) return;
  const before = JSON.stringify(r.meta);
  const part = await getOurPart();
  await deletePart(part!);
  await addPart(partXml(r.meta));
  const after = await readMeta();
  const same = JSON.stringify(after?.meta) === before;
  log(`✓ delete+add відпрацював`, 'ok');
  log(`  блоб ідентичний після перезапису: ${same ? 'ТАК' : 'НІ'}`, same ? 'ok' : 'bad');
  log(`  → тепер збережи файл у Word і прожени pytest`, 'note');
});

on('addField', async () => {
  const r = await readMeta();
  if (!r) return;
  const meta = r.meta;
  meta.fields = meta.fields.filter((f: any) => f.id !== 'spike_field');
  meta.fields.push({
    id: 'spike_field', tab: meta.tabs[0].id, type: 'text',
    label: 'Поле, додане надстройкою', required: false,
  });
  const part = await getOurPart();
  await deletePart(part!);
  await addPart(partXml(meta));
  const after = await readMeta();
  const ok = after?.meta?.fields?.some((f: any) => f.id === 'spike_field');
  log(`✓ записано, fields тепер: ${after?.meta?.fields?.length}`, ok ? 'ok' : 'bad');
  log(`  кирилиця вціліла: ${after?.meta?.service?.title}`, 'note');
});

// ── 3. authoring mechanics ───────────────────────────────────────────────────

on('insertField', async () => {
  await Word.run(async (ctx) => {
    const sel = ctx.document.getSelection();
    sel.load('text');
    await ctx.sync();
    if (!sel.text.trim()) return log('✗ нічого не виділено', 'bad');
    log(`виділено: "${sel.text.slice(0, 60)}"`);
    sel.insertText('{{ spike_field }}', Word.InsertLocation.replace);
    await ctx.sync();
    log('✓ виділення замінено на {{ spike_field }}', 'ok');
  });
});

/** THE load-bearing unknown: paragraph.insertParagraph(text, "Before"|"After"). */
on('wrap', async () => {
  await Word.run(async (ctx) => {
    const paras = ctx.document.getSelection().paragraphs;
    paras.load('items/text');
    await ctx.sync();
    if (!paras.items.length) return log('✗ виділення не містить абзаців', 'bad');
    log(`виділено абзаців: ${paras.items.length}`);
    const firstP = paras.items[0];
    const lastP = paras.items[paras.items.length - 1];
    firstP.insertParagraph("{%p if spike_guard == 'yes' %}", Word.InsertLocation.before);
    lastP.insertParagraph('{%p endif %}', Word.InsertLocation.after);
    await ctx.sync();
    log('✓ insertParagraph(Before/After) ПРАЦЮЄ — блок обгорнуто', 'ok');
    log('  → 📋 знято: механіка ветвлення підтверджена', 'note');
  });
});

on('cc', async () => {
  await Word.run(async (ctx) => {
    const sel = ctx.document.getSelection();
    const control = sel.insertContentControl();
    control.tag = "if:spike_guard==yes";
    control.title = 'Розгалуження (spike)';
    control.appearance = 'BoundingBox' as Word.ContentControlAppearance;
    control.color = 'blue';
    await ctx.sync();
    log('✓ Content Control поставлено (tag=if:spike_guard==yes)', 'ok');
    log('  → варіант B життєздатний: маркер без jinja у тексті', 'note');
  });
});

on('hidden', async () => {
  await Word.run(async (ctx) => {
    const font = ctx.document.getSelection().font;
    font.load();
    await ctx.sync();
    const has = 'hidden' in font;
    log(`font.hidden присутній в API: ${has ? 'ТАК' : 'НІ'}`, has ? 'ok' : 'bad');
    if (!has) return log('  → варіант A не сховає контрол-абзаци; лишається B', 'note');
    try {
      (font as any).hidden = true;
      await ctx.sync();
      log('  ✓ і встановлюється — контрол-абзаци можна сховати від юриста', 'ok');
    } catch (e) {
      fail('font.hidden = true', e);
    }
  });
});

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) {
    log(`✗ це не Word (host=${info.host})`, 'bad');
    return;
  }
  logEl.textContent = '';
  first = false;
  log('Office готовий. Відкрий torture-poc.docx і тисни кнопки згори вниз.', 'note');
});
