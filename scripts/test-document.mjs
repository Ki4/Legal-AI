#!/usr/bin/env node
/**
 * Document quality test runner
 *
 * Usage:
 *   node scripts/test-document.mjs                # test all services
 *   node scripts/test-document.mjs divorce        # test one service
 *   node scripts/test-document.mjs --update-golden  # regenerate golden files
 *
 * To add a new service:
 *   1. Create test-data/{service}/fixtures/scenario-N.mjs  (exports: answers, mockAi, description)
 *   2. Create n8n-templates/{service}-document.js          (exports: build{Service}Document via global fn)
 *   3. Add assertion function to ASSERTIONS map below
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const UPDATE_GOLDEN = process.argv.includes('--update-golden');

// Optional: node test-document.mjs divorce
const serviceFilter = process.argv.slice(2).find(a => !a.startsWith('-'));

// ─── Template loader ──────────────────────────────────────────────────────────
// Loads n8n-templates/{service}-document.js into a VM sandbox without modifying
// the original file (which must remain plain JS for n8n copy-paste).

function loadTemplate(service) {
  const templatePath = join(ROOT, 'n8n', 'templates', `${service}-document.js`);
  const code = readFileSync(templatePath, 'utf-8');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

// ─── Similarity (set-based line diff, no deps) ────────────────────────────────

function lineDiff(expected, actual) {
  const expLines = new Set(expected.split('\n').filter(l => l.trim()));
  const actLines = new Set(actual.split('\n').filter(l => l.trim()));
  const removed  = [...expLines].filter(l => !actLines.has(l));
  const added    = [...actLines].filter(l => !expLines.has(l));
  const total    = Math.max(expLines.size, actLines.size);
  const common   = expLines.size - removed.length;
  const score    = total === 0 ? 100 : Math.round((common / total) * 100);
  return { removed, added, score };
}

// ─── Service-specific structural assertions ───────────────────────────────────
// Add new service: ASSERTIONS.alimony = (answers, doc) => [ ['check name', bool], ... ]

const ASSERTIONS = {
  divorce(a, doc) {
    return [
      ['ПОЗОВНА ЗАЯВА присутня',          doc.includes('ПОЗОВНА ЗАЯВА')],
      ['Підзаголовок розірвання шлюбу',   doc.includes('про розірвання шлюбу')],
      ['Секція П Р О Ш У',                doc.includes('П Р О Ш У')],
      ['Секція Додатки',                  doc.includes('Додатки:')],
      ['Прізвище позивача',               doc.includes(a.last_name)],
      ['Прізвище відповідача',            doc.includes(a.spouse_last_name)],
      ['Місце реєстрації шлюбу',          a.marriage_place.split(/\s+/).filter(w => w.length > 3).some(w => doc.includes(w))],
      ['ч.3 ст.105 СК України',           doc.includes('ч.3 ст.105 СК України')],
      ['ст.110 СК України',               doc.includes('ст.110 СК України')],
      ['п.6 ч.3 ст.175 ЦПК',             doc.includes('п.6 ч.3 ст.175 ЦПК України')],
      ['п.9 ч.3 ст.175 ЦПК',             doc.includes('п.9 ч.3 ст.175 ЦПК України')],
      ['п.10 ч.3 ст.175 ЦПК',            doc.includes('п.10 ч.3 ст.175 ЦПК України')],
      ['Діти (якщо є)',                   !a.has_children       || doc.includes('неповнолітні діти')],
      ['Аліменти (якщо є)',               !a.alimony_claim      || doc.includes('аліменти')],
      ['Спільне майно (якщо є)',          !a.has_joint_property || doc.includes('спільне майно')],
      ['Боргові зобов\'язання (якщо є)',  !a.debt_claim         || doc.includes('боргові зобов')],
      ['Звільнення від збору (якщо є)',   a.court_fee_exempt !== 'yes' || doc.includes('звільнен')],
    ];
  },
};

// ─── Load external assertions for non-hardcoded services ─────────────────────
// Format: test-data/{service}/assertions.mjs → export default function(answers, doc) { return [['name', bool]] }

async function loadExternalAssertions(serviceList) {
  for (const svc of serviceList) {
    if (ASSERTIONS[svc]) continue;
    const p = join(ROOT, 'test-data', svc, 'assertions.mjs');
    if (existsSync(p)) {
      try {
        const mod = await import(pathToFileURL(p).href);
        ASSERTIONS[svc] = mod.default || mod.assertions;
        console.log(`  📦 Loaded assertions for "${svc}" from assertions.mjs`);
      } catch (e) {
        console.warn(`  ⚠️  Failed to load assertions for "${svc}": ${e.message}`);
      }
    }
  }
}

// ─── Per-service runner ───────────────────────────────────────────────────────

async function runService(service) {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  Service: ${service.toUpperCase()}`);
  console.log('═'.repeat(62));

  let sandbox;
  try {
    sandbox = loadTemplate(service);
  } catch (e) {
    console.error(`  ❌ Cannot load template: ${e.message}`);
    return false;
  }

  // PascalCase: "court_search" → "CourtSearch", "divorce" → "Divorce"
  const pascal  = service.split(/[-_]/).map(w => w[0].toUpperCase() + w.slice(1)).join('');
  const fnName  = `build${pascal}Document`;
  const buildFn = sandbox[fnName];
  if (typeof buildFn !== 'function') {
    console.error(`  ❌ ${fnName} not found in template`);
    return false;
  }

  const fixturesDir = join(ROOT, 'test-data', service, 'fixtures');
  const expectedDir = join(ROOT, 'test-data', service, 'expected');
  if (!existsSync(expectedDir)) mkdirSync(expectedDir, { recursive: true });

  const fixtures = readdirSync(fixturesDir)
    .filter(f => /^scenario-\d+\.mjs$/.test(f))
    .sort();

  if (fixtures.length === 0) {
    console.log('  ⚠️  No fixture files found in', fixturesDir);
    return true;
  }

  const assertFn    = ASSERTIONS[service];
  let   servicePassed = true;

  for (const file of fixtures) {
    const scenarioName = file.replace('.mjs', '');
    const fixtureUrl   = pathToFileURL(join(fixturesDir, file)).href;
    const fixture      = await import(fixtureUrl);
    const { answers, mockAi, description = '' } = fixture;

    const doc = buildFn(answers, mockAi);

    console.log(`\n  ▶ ${scenarioName}${description ? ': ' + description : ''}`);

    // — Structural assertions —
    if (assertFn) {
      const checks  = assertFn(answers, doc);
      const okCount = checks.filter(([, v]) => v).length;
      if (okCount === checks.length) {
        console.log(`    ✅ Structural: ${okCount}/${checks.length}`);
      } else {
        console.log(`    ❌ Structural: ${okCount}/${checks.length}`);
        checks.filter(([, v]) => !v).forEach(([name]) => console.log(`       ✗ ${name}`));
        servicePassed = false;
      }
    }

    // — Golden file —
    const goldenPath = join(expectedDir, `${scenarioName}.txt`);
    if (UPDATE_GOLDEN || !existsSync(goldenPath)) {
      writeFileSync(goldenPath, doc, 'utf-8');
      const action = UPDATE_GOLDEN ? 'updated' : 'created';
      console.log(`    📝 Golden: ${action} → test-data/${service}/expected/${scenarioName}.txt`);
    } else {
      const golden = readFileSync(goldenPath, 'utf-8');
      const { removed, added, score } = lineDiff(golden, doc);

      if (score === 100) {
        console.log(`    ✅ Golden: 100% match`);
      } else {
        const icon = score >= 90 ? '⚠️ ' : '❌';
        const diffCount = removed.length + added.length;
        console.log(`    ${icon} Golden: ${score}% match (${diffCount} diff lines)`);
        const SHOW = 6;
        removed.slice(0, SHOW).forEach(l => console.log(`       - ${l}`));
        added.slice(0, SHOW).forEach(l => console.log(`       + ${l}`));
        if (diffCount > SHOW * 2) console.log(`       ... +${diffCount - SHOW * 2} more`);
        if (score < 90) servicePassed = false;
      }
    }
  }

  const icon = servicePassed ? '✅' : '❌';
  console.log(`\n  ${icon} ${service}: ${fixtures.length} scenarios`);
  return servicePassed;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const testDataDir = join(ROOT, 'test-data');
const services = serviceFilter
  ? [serviceFilter]
  : readdirSync(testDataDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();

if (services.length === 0) {
  console.log('No service directories found in test-data/');
  process.exit(0);
}

// Load external assertions before running tests
await loadExternalAssertions(services);

let allOk = true;
for (const service of services) {
  const ok = await runService(service);
  if (!ok) allOk = false;
}

console.log('\n' + '═'.repeat(62));
console.log(allOk
  ? '  ✅  ALL TESTS PASSED'
  : '  ❌  SOME TESTS FAILED — run with --update-golden to refresh');
console.log('═'.repeat(62) + '\n');

process.exit(allOk ? 0 : 1);
