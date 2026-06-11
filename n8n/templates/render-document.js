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
  if (content.startsWith('!')) return 'comment'; // includes {{!style: ...}} directives
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

function renderNodes(nodes, scopes) {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        out += n.value;
        break;
      case 'interp':
        out += formatValue(resolvePath(n.path, scopes), n.raw);
        break;
      case 'helper': {
        const args = n.args.map((a) => evalValue(a, scopes));
        const r = HELPERS[n.name](...args);
        out += r === null || r === undefined ? '' : String(r);
        break;
      }
      case 'if':
        for (const b of n.branches) {
          if (b.expr === null || evalExpr(b.expr, scopes)) { out += renderNodes(b.body, scopes); break; }
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
            out += renderNodes(n.body, scopes);
            scopes.pop();
          });
        }
        break;
      }
      default:
        throw new Error(`Unknown node type "${n.type}"`);
    }
  }
  return out;
}

/** Main entry: template string + context → document string. */
function renderDocument(template, context) {
  const ast = parseTemplate(template);
  return renderNodes(ast, [{ item: context, meta: null }]);
}

// ─── Helpers (legally-critical logic — written & tested ONCE, shared) ────────

const MONTHS = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

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

/** "свідоцтво №..." → "свідоцтвом №..." (instrumental after "підтверджується") */
function normalizeCert(certInfo) {
  if (!certInfo) return certInfo;
  if (certInfo.toLowerCase().startsWith('свідоцтво ')) {
    return 'свідоцтвом ' + certInfo.slice('свідоцтво '.length);
  }
  return certInfo;
}

/**
 * children_details (one child per line: "ПІБ, дата, свідоцтво № ... від ...")
 * → [{ name, birthDate, certInfo, certInstrumental, gender }]
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
  const defendantName = joinName(a.defendant_last_name, a.defendant_first_name, a.defendant_middle_name);

  const children = parseChildrenDetails(a.children_details);

  const aiSafe = {
    plaintiff_instrumental: aiIn.plaintiff_instrumental || plaintiffName,
    plaintiff_genitive: aiIn.plaintiff_genitive || plaintiffName,
    defendant_instrumental: aiIn.defendant_instrumental || defendantName,
    defendant_genitive: aiIn.defendant_genitive || defendantName,
    marriage_place_locative: aiIn.marriage_place_locative || a.marriage_place || FALLBACK,
    children_genitive: aiIn.children_genitive
      || (children.length ? children.map((c) => `${c.name}, ${c.birthDate} р.н.`).join('; ') : FALLBACK),
  };

  return {
    ...a,
    plaintiff_name: plaintiffName,
    defendant_name: defendantName,
    plaintiff_gender: detectGender(a.middle_name),
    defendant_gender: detectGender(a.defendant_middle_name),
    children,
    has_children: children.length > 0,
    n_children: children.length || 1,
    first_child_gender: children.length ? children[0].gender : 'male',
    ai: aiSafe,
  };
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderDocument,
    parseTemplate,
    buildContext,
    HELPERS,
    FALLBACK,
    // internals exposed for unit tests
    truthy,
    parseExpr,
    detectGender,
    parseChildrenDetails,
    normalizeCert,
  };
}
