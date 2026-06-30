/**
 * render-document.js
 * n8n Code Node — service-agnostic document render engine (doc-engine, #34).
 *
 * Renders a declarative template (stored in services.document_template) against
 * the form answers + AI declensions. The template is DATA edited by a lawyer;
 * this engine is the only CODE — written once, tested once, shared by all
 * template-mode services.
 *
 * DSL contract (specs/features/doc-engine/requirements.md §3):
 *   {{field}}                  interpolation; empty → '________' fallback
 *   {{field|raw}}              interpolation without fallback
 *   {{helper arg 'lit' 42}}    helper call (registered helpers only)
 *   {{#if expr}} {{else if expr}} {{else}} {{/if}}
 *       expr: truthiness | == != > < >= <= | and / or / not (flat chains)
 *   {{#each path}} ... {{/each}}   with {{@index1}} {{@first}} {{@last}}
 *   {{! comment }}             dropped from output
 *   {{!style: ...}}            phase-2 paragraph style directive — IGNORED in
 *                              phase 1 (reserved: right center bold indent
 *                              keep-with-next keep-together page-break-before)
 *   {{!style: keep-block}} … {{!style: /keep-block}}
 *                              paired range macro: keep a whole block (e.g.
 *                              "Додатки:" → signature) together across page
 *                              breaks. Desugars to a keep-with-next chain on
 *                              every paragraph of the range except the last,
 *                              so no downstream renderer needs keep-block support.
 *
 * Block tags / comments standing alone on a line consume that line (so the
 * template reads like the document and output stays byte-exact).
 *
 * SECURITY: pure parser — no eval / new Function. A lawyer-edited template
 * cannot execute code inside n8n.
 *
 * n8n entry point (inside Build Document node):
 *   const context = buildContext(answers, ai);
 *   const document = renderDocument(svc.document_template, context);
 */

const FALLBACK = '________';

// ─── Tokenizer ───────────────────────────────────────────────────────────────

const TAG_RE = /\{\{([\s\S]*?)\}\}/g;

function tokenize(template) {
  const tokens = [];
  let last = 0;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(template)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: template.slice(last, m.index) });
    const line = template.slice(0, m.index).split('\n').length;
    tokens.push({ type: 'tag', content: m[1].trim(), line });
    last = TAG_RE.lastIndex;
  }
  if (last < template.length) tokens.push({ type: 'text', value: template.slice(last) });
  return tokens;
}

function classifyTag(content) {
  if (content.startsWith('!style:')) return 'style';
  if (content.startsWith('!')) return 'comment';
  if (content.startsWith('#if ')) return 'if';
  if (content === 'else') return 'else';
  if (content.startsWith('else if ')) return 'elseif';
  if (content === '/if') return 'endif';
  if (content.startsWith('#each ')) return 'each';
  if (content === '/each') return 'endeach';
  return 'interp';
}

/**
 * Mustache-style standalone handling: a non-interpolation tag alone on its
 * line swallows the line (leading indent + trailing newline). Detection runs
 * on the ORIGINAL text so adjacent standalone tags don't double-consume.
 */
function applyStandalone(tokens) {
  const standalone = tokens.map((t, i) => {
    if (t.type !== 'tag' || classifyTag(t.content) === 'interp') return false;
    // 'style' directives are standalone (same rule as other block tags)
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    const prevOk = !prev || (prev.type === 'text' && /(^|\n)[ \t]*$/.test(prev.value));
    const nextOk = !next || (next.type === 'text' && /^[ \t]*(\n|$)/.test(next.value));
    return prevOk && nextOk;
  });
  tokens.forEach((t, i) => {
    if (!standalone[i]) return;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (prev && prev.type === 'text') prev.value = prev.value.replace(/[ \t]+$/, '');
    if (next && next.type === 'text') next.value = next.value.replace(/^[ \t]*\n/, '');
  });
  return tokens;
}

// ─── Argument / expression tokenizer ─────────────────────────────────────────

/** Split tag content into words and 'quoted literals' (literals may hold spaces). */
function splitArgs(s, line) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    if (s[i] === "'") {
      const end = s.indexOf("'", i + 1);
      if (end === -1) throw new Error(`Unterminated string literal in "{{${s}}}" at line ${line}`);
      out.push({ kind: 'lit', value: s.slice(i + 1, end) });
      i = end + 1;
    } else {
      let j = i;
      while (j < s.length && !/\s/.test(s[j])) j++;
      out.push({ kind: 'word', value: s.slice(i, j) });
      i = j;
    }
  }
  return out;
}

const NUM_RE = /^-?\d+(\.\d+)?$/;

function toOperand(tok) {
  if (tok.kind === 'lit') return { op: 'lit', value: tok.value };
  if (NUM_RE.test(tok.value)) return { op: 'num', value: Number(tok.value) };
  return { op: 'path', value: tok.value };
}

const CMP_OPS = ['==', '!=', '>=', '<=', '>', '<'];

/** Recursive-descent boolean expression parser: or → and → not → cmp → value. */
function parseExpr(src, line) {
  const toks = splitArgs(src, line);
  let p = 0;
  const isWord = (v) => p < toks.length && toks[p].kind === 'word' && toks[p].value === v;

  function parseOr() {
    let left = parseAnd();
    while (isWord('or')) { p++; left = { op: 'or', left, right: parseAnd() }; }
    return left;
  }
  function parseAnd() {
    let left = parseNot();
    while (isWord('and')) { p++; left = { op: 'and', left, right: parseNot() }; }
    return left;
  }
  function parseNot() {
    if (isWord('not')) { p++; return { op: 'not', operand: parseNot() }; }
    return parseCmp();
  }
  function parseCmp() {
    const left = parseValue();
    if (p < toks.length && toks[p].kind === 'word' && CMP_OPS.includes(toks[p].value)) {
      const op = toks[p].value;
      p++;
      return { op, left, right: parseValue() };
    }
    return { op: 'truthy', operand: left };
  }
  function parseValue() {
    if (p >= toks.length) throw new Error(`Incomplete expression "${src}" at line ${line}`);
    const t = toks[p];
    if (t.kind === 'word' && (CMP_OPS.includes(t.value) || ['and', 'or', 'not'].includes(t.value))) {
      throw new Error(`Unexpected "${t.value}" in expression "${src}" at line ${line}`);
    }
    p++;
    return toOperand(t);
  }

  const ast = parseOr();
  if (p < toks.length) throw new Error(`Unexpected "${toks[p].value}" in expression "${src}" at line ${line}`);
  return ast;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

function parseTemplate(template) {
  const tokens = applyStandalone(tokenize(String(template).replace(/\r\n/g, '\n')));
  let pos = 0;

  function peekKind() {
    const t = tokens[pos];
    return t && t.type === 'tag' ? classifyTag(t.content) : null;
  }

  function parseInterp(t) {
    let content = t.content;
    let raw = false;
    const rawMatch = content.match(/^(.*?)\s*\|\s*raw$/);
    if (rawMatch) { content = rawMatch[1].trim(); raw = true; }
    const parts = splitArgs(content, t.line);
    if (parts.length === 0) throw new Error(`Empty tag {{}} at line ${t.line}`);
    if (parts.length > 1) {
      const name = parts[0].value;
      if (parts[0].kind !== 'word' || !HELPERS[name]) {
        throw new Error(`Unknown helper "${name}" at line ${t.line}`);
      }
      return { type: 'helper', name, args: parts.slice(1).map(toOperand), line: t.line };
    }
    if (parts[0].kind === 'lit') return { type: 'text', value: parts[0].value };
    return { type: 'interp', path: parts[0].value, raw, line: t.line };
  }

  function parseNodes(stopKinds, openLine, openWhat) {
    const nodes = [];
    while (pos < tokens.length) {
      const t = tokens[pos];
      if (t.type === 'text') { nodes.push({ type: 'text', value: t.value }); pos++; continue; }
      const kind = classifyTag(t.content);
      if (stopKinds.includes(kind)) return nodes;
      pos++;
      if (kind === 'comment') continue;
      if (kind === 'style') {
        const styles = t.content.slice(7).trim().split(/\s+/).filter(Boolean);
        nodes.push({ type: 'style', styles, line: t.line });
        continue;
      }
      if (kind === 'interp') { nodes.push(parseInterp(t)); continue; }

      if (kind === 'if') {
        const branches = [];
        branches.push({ expr: parseExpr(t.content.slice(4), t.line), body: parseNodes(['elseif', 'else', 'endif'], t.line, '{{#if}}') });
        let sawElse = false;
        for (;;) {
          if (pos >= tokens.length) throw new Error(`Unclosed {{#if}} opened at line ${t.line}`);
          const bt = tokens[pos];
          const bkind = classifyTag(bt.content);
          if (bkind === 'elseif') {
            if (sawElse) throw new Error(`{{else if}} after {{else}} at line ${bt.line}`);
            pos++;
            branches.push({ expr: parseExpr(bt.content.slice(8), bt.line), body: parseNodes(['elseif', 'else', 'endif'], t.line, '{{#if}}') });
          } else if (bkind === 'else') {
            if (sawElse) throw new Error(`Duplicate {{else}} at line ${bt.line}`);
            sawElse = true;
            pos++;
            branches.push({ expr: null, body: parseNodes(['elseif', 'else', 'endif'], t.line, '{{#if}}') });
          } else { // endif
            pos++;
            break;
          }
        }
        nodes.push({ type: 'if', branches, line: t.line });
        continue;
      }

      if (kind === 'each') {
        const path = t.content.slice(6).trim();
        if (!path) throw new Error(`{{#each}} without a path at line ${t.line}`);
        const body = parseNodes(['endeach'], t.line, '{{#each}}');
        if (pos >= tokens.length) throw new Error(`Unclosed {{#each}} opened at line ${t.line}`);
        pos++; // consume {{/each}}
        nodes.push({ type: 'each', path, body, line: t.line });
        continue;
      }

      // stray else / endif / endeach outside their block
      throw new Error(`Unexpected {{${t.content}}} at line ${t.line}${openWhat ? ` (inside ${openWhat} from line ${openLine})` : ''}`);
    }
    if (stopKinds.length) throw new Error(`Unclosed ${openWhat} opened at line ${openLine}`);
    return nodes;
  }

  return parseNodes([], 0, null);
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

/** has()-semantics: null/undefined/''/false and the string 'false' are falsy. */
function truthy(v) {
  return v !== null && v !== undefined && v !== '' && v !== false && v !== 'false';
}

function walkPath(obj, segs) {
  let cur = obj;
  for (const s of segs) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[s];
  }
  return cur;
}

/**
 * Resolve a dotted path against the scope stack.
 * scopes[0] is always { item: rootContext }; {{#each}} pushes { item, meta }.
 */
function resolvePath(path, scopes) {
  if (path === '.' || path === 'this') return scopes[scopes.length - 1].item;
  let segs = path.split('.');
  if (segs[0] === 'this') {
    return walkPath(scopes[scopes.length - 1].item, segs.slice(1));
  }
  if (segs[0].startsWith('@')) {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].meta && segs[0] in scopes[i].meta) return scopes[i].meta[segs[0]];
    }
    return undefined;
  }
  for (let i = scopes.length - 1; i >= 0; i--) {
    const item = scopes[i].item;
    if (item !== null && typeof item === 'object' && segs[0] in item) return walkPath(item, segs);
  }
  return undefined;
}

function evalValue(node, scopes) {
  if (node.op === 'lit' || node.op === 'num') return node.value;
  return resolvePath(node.value, scopes);
}

function looseEquals(l, r) {
  return String(l === null || l === undefined ? '' : l) === String(r === null || r === undefined ? '' : r);
}

function evalExpr(node, scopes) {
  switch (node.op) {
    case 'truthy': return truthy(evalValue(node.operand, scopes));
    case 'not': return !evalExpr(node.operand, scopes);
    case 'and': return evalExpr(node.left, scopes) && evalExpr(node.right, scopes);
    case 'or': return evalExpr(node.left, scopes) || evalExpr(node.right, scopes);
    case '==': return looseEquals(evalValue(node.left, scopes), evalValue(node.right, scopes));
    case '!=': return !looseEquals(evalValue(node.left, scopes), evalValue(node.right, scopes));
    case '>': return Number(evalValue(node.left, scopes)) > Number(evalValue(node.right, scopes));
    case '<': return Number(evalValue(node.left, scopes)) < Number(evalValue(node.right, scopes));
    case '>=': return Number(evalValue(node.left, scopes)) >= Number(evalValue(node.right, scopes));
    case '<=': return Number(evalValue(node.left, scopes)) <= Number(evalValue(node.right, scopes));
    default: throw new Error(`Unknown expression op "${node.op}"`);
  }
}

// ─── Renderer ────────────────────────────────────────────────────────────────

function formatValue(v, raw) {
  if (v === null || v === undefined || v === '') return raw ? '' : FALLBACK;
  return String(v);
}

/**
 * Shared builder used by both renderDocument and renderDocumentWithStyles.
 * sb = { text: string, styleEvents: Array<{charOffset, styles}> }
 * styleEvents is only populated when sb is shared (renderDocumentWithStyles).
 */
function renderNodesInto(nodes, scopes, sb) {
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        sb.text += n.value;
        break;
      case 'style':
        sb.styleEvents.push({ charOffset: sb.text.length, styles: n.styles });
        break;
      case 'interp':
        sb.text += formatValue(resolvePath(n.path, scopes), n.raw);
        break;
      case 'helper': {
        const args = n.args.map((a) => evalValue(a, scopes));
        const r = HELPERS[n.name](...args);
        sb.text += r === null || r === undefined ? '' : String(r);
        break;
      }
      case 'if':
        for (const b of n.branches) {
          if (b.expr === null || evalExpr(b.expr, scopes)) { renderNodesInto(b.body, scopes, sb); break; }
        }
        break;
      case 'each': {
        const arr = resolvePath(n.path, scopes);
        if (Array.isArray(arr)) {
          arr.forEach((item, i) => {
            scopes.push({
              item,
              meta: { '@index': i, '@index1': i + 1, '@first': i === 0, '@last': i === arr.length - 1 },
            });
            renderNodesInto(n.body, scopes, sb);
            scopes.pop();
          });
        }
        break;
      }
      default:
        throw new Error(`Unknown node type "${n.type}"`);
    }
  }
}

/** Main entry: template string + context → document string. */
function renderDocument(template, context) {
  const ast = parseTemplate(template);
  const sb = { text: '', styleEvents: [] };
  renderNodesInto(ast, [{ item: context, meta: null }], sb);
  return sb.text;
}

/**
 * Like renderDocument but also returns styleHints:
 *   { text: string, styleHints: { [paraIdx]: string[] } }
 * paraIdx is the 0-based paragraph index in the output text (split by '\n').
 * A {{!style: center bold}} before a line means that line's paragraph has those styles.
 * Used by the typography phase-2 pipeline to build Google Docs batchUpdate requests.
 *
 * keep-block desugaring: a {{!style: keep-block}} … {{!style: /keep-block}} pair
 * is a range macro — it adds `keep-with-next` to every paragraph from the open
 * marker up to (but excluding) the block's last paragraph, gluing the block into
 * one unit that never splits across a page (research §3, the orphaned-signature
 * fix). Downstream adapters (Google Docs today, HTML/DOCX later) only ever see
 * keep-with-next, so none of them needs to understand keep-block.
 */
function renderDocumentWithStyles(template, context) {
  const ast = parseTemplate(template);
  const sb = { text: '', styleEvents: [] };
  renderNodesInto(ast, [{ item: context, meta: null }], sb);

  const styleHints = {};
  const addStyle = (paraIdx, kw) => {
    if (!styleHints[paraIdx]) styleHints[paraIdx] = [];
    if (!styleHints[paraIdx].includes(kw)) styleHints[paraIdx].push(kw);
  };

  const blockStack = []; // open keep-block paraIdx markers (supports nesting)

  for (const { charOffset, styles } of sb.styleEvents) {
    const paraIdx = sb.text.slice(0, charOffset).split('\n').length - 1;
    for (const kw of styles) {
      if (kw === 'keep-block') {
        blockStack.push(paraIdx);
      } else if (kw === '/keep-block') {
        const start = blockStack.pop();
        if (start === undefined) continue; // unbalanced close — ignore defensively
        // close marker sits one paragraph past the block's last line, so the
        // block spans [start .. paraIdx-1]; glue all but the last paragraph.
        for (let p = start; p <= paraIdx - 2; p++) addStyle(p, 'keep-with-next');
      } else {
        addStyle(paraIdx, kw);
      }
    }
  }
  return { text: sb.text, styleHints };
}

// ─── Helpers (legally-critical logic — written & tested ONCE, shared) ────────

const MONTHS = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

/**
 * Registry — slow-changing legal constants (прожитковий мінімум, 2026).
 * SSoT for amounts that drift yearly; template/helpers read this, never hardcode
 * (alimony-change §3.3/§3.4, research 2026-06-15, ярус-3 sign-off pending Olga).
 */
const REGISTRY = {
  pm_able_bodied_2026: 3328,
  pm_child_under6_2026: 2817,
  pm_child_6to18_2026: 3512,
};

const HELPERS = {
  /** ISO date → "20 червня 2015" */
  formatDate(iso) {
    if (!iso) return FALLBACK;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return FALLBACK;
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  },
  /** ISO date → "«20» червня 2015" */
  formatDateQuoted(iso) {
    if (!iso) return '«___» _______ _____';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '«___» _______ _____';
    return `«${d.getUTCDate()}» ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  },
  /** gender value ('male'|'female') → word form */
  gender(g, maleWord, femaleWord) {
    return g === 'female' ? femaleWord : maleWord;
  },
  /**
   * 2 forms: plural(n, 'дитина', 'діти') → n===1 ? one : many.
   * 3 forms (Ukrainian): plural(n, 'дитина', 'дитини', 'дітей').
   */
  plural(n, one, few, many) {
    const num = Math.abs(Number(n) || 0);
    if (many === undefined) return num === 1 ? one : few;
    const m10 = num % 10;
    const m100 = num % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  },
  /** Alimony share per number of children (ст. 183 СК України practice). */
  alimonyFraction(n) {
    const k = Number(n) || 1;
    if (k >= 3) return '1/2';
    if (k === 2) return '1/3';
    return '1/4';
  },
  /** Join args skipping empty values (no separator). */
  concat(...parts) {
    return parts.filter((p) => p !== null && p !== undefined && p !== '').join('');
  },
  /** Value (fallback '________' when empty) with a guaranteed trailing period. */
  ensurePeriod(v) {
    const s = truthy(v) ? String(v) : FALLBACK;
    return s.endsWith('.') ? s : s + '.';
  },
  /** Ukrainian money formatting: 1331.2 → "1 331,20", 24000 → "24 000", 1756 → "1 756". */
  formatMoney(n) {
    if (n === null || n === undefined || n === '') return FALLBACK;
    const num = Number(n);
    if (isNaN(num)) return FALLBACK;
    const rounded = Math.round(num * 100) / 100;
    const [intPart, fracPart] = rounded.toFixed(Number.isInteger(rounded) ? 0 : 2).split('.');
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return fracPart ? `${withSep},${fracPart}` : withSep;
  },
};

// ─── Context builder (computed layer shared by all services) ─────────────────

function detectGender(middleName) {
  if (!middleName) return 'male';
  const m = String(middleName).trim();
  if (m.endsWith('івна') || m.endsWith('ївна') || m.endsWith('овна')) return 'female';
  return 'male';
}

function joinName(...parts) {
  const filled = parts.filter((p) => p !== null && p !== undefined && p !== '');
  return filled.length ? filled.join(' ') : FALLBACK;
}

// ─── Declension stem-guard (C-EXCEPTION DO-NOW) ───────────────────────────────
// The declension step is the ONE live LLM call in the otherwise-deterministic
// pipeline. AI output is trusted blindly today: an empty field falls back to the
// nominative, but a HALLUCINATED field (wrong name, garbage, dropped word) goes
// straight into a court document. This guard is a deterministic post-check — a
// declined form must keep the STEM of its nominative source; if it doesn't we
// revert to the nominative (same safe outcome as if the AI had returned nothing).
//
// Tuned LENIENT on purpose. Ukrainian inflection only swaps word endings, so a
// correct declension always shares a long common prefix per word. We reject only
// CLEAR mismatches (swapped word, changed word-count). The asymmetry is deliberate:
// wrongly reverting a CORRECT form degrades quality, so when unsure we ACCEPT.

function normalizeDeclensionWord(w) {
  return String(w)
    .toLowerCase()
    .replace(/[’'`´]/g, "'") // unify apostrophe variants (Гур'єв)
    .replace(/[.,;:]/g, '');           // strip trailing punctuation
}

function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

// One word passes if its declined form shares enough of a stem with the
// nominative word. Endings are ~1–4 chars, so we require the common prefix to
// cover at least half of the shorter word (min 2 chars): clears real inflection
// (Іванова→Іванову, Інна→Інни) and harsher fleeting-vowel cases (Орел→Орла),
// while rejecting a swapped surname (Іванова→Петренко).
function wordStemOk(nomWord, decWord) {
  const a = normalizeDeclensionWord(nomWord);
  const b = normalizeDeclensionWord(decWord);
  if (!a || !b) return false;
  if (a === b) return true; // indeclinable / unchanged (м., РАЦС, у)
  const minLen = Math.min(a.length, b.length);
  const lcp = commonPrefixLen(a, b);
  const need = Math.max(2, Math.ceil(minLen / 2));
  return lcp >= need;
}

// Whole-name guard: equal word-count AND every word keeps its stem. Any failure
// → caller reverts the ENTIRE field to nominative (never mix a half-trusted
// declension into a legal name).
function declensionStemOk(nominative, declined) {
  const nomWords = String(nominative || '').trim().split(/\s+/).filter(Boolean);
  const decWords = String(declined || '').trim().split(/\s+/).filter(Boolean);
  if (!decWords.length) return false;
  if (nomWords.length !== decWords.length) return false;
  return nomWords.every((w, i) => wordStemOk(w, decWords[i]));
}

// Returns the AI declension when it passes the stem-guard, else the nominative.
// Subsumes the old `aiIn.x || nominative` empty-fallback (empty → fails → nominative).
function guardDeclension(nominative, aiDeclined) {
  if (aiDeclined && declensionStemOk(nominative, aiDeclined)) return aiDeclined;
  return nominative;
}

/** "свідоцтво №..." → "свідоцтвом №..." (instrumental after "підтверджується") */
function normalizeCert(certInfo) {
  if (!certInfo) return certInfo;
  if (certInfo.toLowerCase().startsWith('свідоцтво ')) {
    return 'свідоцтвом ' + certInfo.slice('свідоцтво '.length);
  }
  return certInfo;
}

/** "6000" / "6 000" / "6000,50" → number, or null if empty/unparseable. */
function parseMoney(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** "DD.MM.YYYY" (parseChildrenDetails format) → age in full years as of `now`, or null. */
function ageFromBirthDate(birthDate, now = new Date()) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(birthDate || '').trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const bd = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  let age = now.getUTCFullYear() - bd.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - bd.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < bd.getUTCDate())) age--;
  return age;
}

/** 50% ПМ для дитини відповідного віку (alimony-change §3.3), or null if age unknown. */
function pmFloorForAge(age) {
  if (age === null || age === undefined) return null;
  return (age < 6 ? REGISTRY.pm_child_under6_2026 : REGISTRY.pm_child_6to18_2026) / 2;
}

/**
 * children_details (one child per line: "ПІБ, дата, свідоцтво № ... від ...")
 * → [{ raw, name, birthDate, certInfo, certInstrumental, gender }]
 * `raw` keeps the trimmed line as typed (divorce inlines it verbatim).
 */
function parseChildrenDetails(details) {
  if (!details) return [];
  return String(details)
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/,\s*/);
      const name = (parts[0] || '').trim();
      const birthDate = (parts[1] || '').trim();
      const certInfo = parts.slice(2).join(', ').trim();
      const nameParts = name.split(/\s+/);
      return {
        raw: line,
        name,
        birthDate,
        certInfo,
        certInstrumental: normalizeCert(certInfo),
        gender: detectGender(nameParts[2]),
      };
    })
    .filter((c) => c.name);
}

/**
 * Build the 3-layer render context: raw answers + ai (with fallbacks) +
 * computed derivations. Computed keys win over same-named answer fields.
 */
function buildContext(answers, ai) {
  const a = answers || {};
  const aiIn = ai || {};

  const plaintiffName = joinName(a.last_name, a.first_name, a.middle_name);
  // The divorce form names the defendant spouse_* (legacy convention) — alias
  // per field so computed values serve both conventions (IMPROVEMENTS #49).
  const defendantName = joinName(
    a.defendant_last_name || a.spouse_last_name,
    a.defendant_first_name || a.spouse_first_name,
    a.defendant_middle_name || a.spouse_middle_name,
  );

  const children = parseChildrenDetails(a.children_details).map((c) => ({
    ...c,
    pmFloor: pmFloorForAge(ageFromBirthDate(c.birthDate)),
  }));

  // alimony-change (§3.3/§3.4): monthly_delta known only when both amounts are
  // fixed sums; price_of_claim/court_fee derive from it, registry-floored.
  const priorAmount = parseMoney(a.prior_alimony_value);
  const requestedAmount = parseMoney(a.requested_alimony_value);
  const monthlyDelta = (a.prior_alimony_type === 'fixed' && a.requested_alimony_type === 'fixed'
    && priorAmount !== null && requestedAmount !== null)
    ? Math.abs(requestedAmount - priorAmount)
    : null;
  const priceOfClaim = monthlyDelta !== null ? monthlyDelta * 12 : null;
  const onePercentOfClaim = priceOfClaim !== null ? Math.round(priceOfClaim * 0.01 * 100) / 100 : null;
  const courtFeeFloor = REGISTRY.pm_able_bodied_2026 * 0.4;
  const courtFee = priceOfClaim !== null ? Math.max(onePercentOfClaim, courtFeeFloor) : null;
  const courtFeeIsFloor = onePercentOfClaim !== null ? onePercentOfClaim <= courtFeeFloor : false;

  // PIB declensions pass through the stem-guard: a hallucinated/garbled name
  // reverts to the nominative instead of reaching the document. The guard also
  // subsumes the old `|| name` empty-fallback (empty AI field → reverts).
  const aiSafe = {
    plaintiff_instrumental: guardDeclension(plaintiffName, aiIn.plaintiff_instrumental),
    plaintiff_genitive: guardDeclension(plaintiffName, aiIn.plaintiff_genitive),
    defendant_instrumental: guardDeclension(defendantName, aiIn.defendant_instrumental || aiIn.spouse_instrumental),
    defendant_genitive: guardDeclension(defendantName, aiIn.defendant_genitive || aiIn.spouse_genitive),
    marriage_place_locative: aiIn.marriage_place_locative || a.marriage_place || FALLBACK,
    children_genitive: aiIn.children_genitive
      || (children.length ? children.map((c) => `${c.name}, ${c.birthDate} р.н.`).join('; ') : FALLBACK),
    // alimony-change L3 (G3+): case-specific обґрунтування зміни обставин.
    // Empty in G1 (no LLM) → {{#if ai.reasoning}} falls through to the
    // template's generic ст.182 fallback paragraph.
    reasoning: aiIn.reasoning || '',
  };

  return {
    ...a,
    plaintiff_name: plaintiffName,
    defendant_name: defendantName,
    plaintiff_gender: detectGender(a.middle_name),
    defendant_gender: detectGender(a.defendant_middle_name || a.spouse_middle_name),
    children,
    has_children: children.length > 0,
    n_children: children.length || 1,
    first_child_gender: children.length ? children[0].gender : 'male',
    monthly_delta: monthlyDelta,
    price_of_claim: priceOfClaim,
    court_fee: courtFee,
    court_fee_is_floor: courtFeeIsFloor,
    ai: aiSafe,
    // escape hatches for templates whose legacy semantics differ from the
    // computed layer: raw form answers (computed keys shadow e.g. has_children)
    // and the raw AI payload (to branch on "did AI provide X").
    answers: a,
    ai_raw: aiIn,
  };
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderDocument,
    renderDocumentWithStyles,
    parseTemplate,
    buildContext,
    HELPERS,
    FALLBACK,
    // internals exposed for unit tests
    truthy,
    parseExpr,
    evalExpr,
    detectGender,
    parseChildrenDetails,
    normalizeCert,
    REGISTRY,
    parseMoney,
    ageFromBirthDate,
    pmFloorForAge,
    // declension stem-guard
    wordStemOk,
    declensionStemOk,
    guardDeclension,
    normalizeDeclensionWord,
  };
}
