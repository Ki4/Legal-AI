#!/usr/bin/env node
/**
 * scaffold-service.mjs
 * Створює skeleton файли для нової послуги.
 *
 * Usage:
 *   node scripts/scaffold-service.mjs alimony "Стягнення аліментів"
 *
 * Creates:
 *   n8n/templates/{slug}-document.js       — document builder skeleton
 *   prompts/{slug}-declension-prompt.txt   — declension prompt (copied from divorce)
 *   test-data/{slug}/fixtures/scenario-1.mjs — test fixture skeleton
 *   test-data/{slug}/expected/.gitkeep     — golden files directory
 *   test-data/{slug}/assertions.mjs        — structural assertions skeleton
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Parse args ─────────────────────────────────────────────────────────────

const [slug, title] = process.argv.slice(2);

if (!slug || !title) {
  console.error('Usage: node scripts/scaffold-service.mjs <slug> "<title>"');
  console.error('Example: node scripts/scaffold-service.mjs alimony "Стягнення аліментів"');
  process.exit(1);
}

// PascalCase for function name: "alimony" → "Alimony", "court_search" → "CourtSearch"
const pascal = slug.split(/[-_]/).map(w => w[0].toUpperCase() + w.slice(1)).join('');
const fnName = `build${pascal}Document`;

console.log(`\n🏗  Scaffolding service: ${slug} ("${title}")`);
console.log(`   Function name: ${fnName}\n`);

// ─── Safety check ───────────────────────────────────────────────────────────

const templatePath = join(ROOT, 'n8n/templates', `${slug}-document.js`);
if (existsSync(templatePath)) {
  console.error(`❌ Template already exists: n8n/templates/${slug}-document.js`);
  console.error('   Use a different slug or delete the existing file.');
  process.exit(1);
}

// ─── Create directories ─────────────────────────────────────────────────────

const dirs = [
  join(ROOT, 'test-data', slug, 'fixtures'),
  join(ROOT, 'test-data', slug, 'expected'),
];
for (const dir of dirs) {
  mkdirSync(dir, { recursive: true });
}

// ─── Read shared utils for inline copy ──────────────────────────────────────

const sharedUtilsPath = join(ROOT, 'n8n/templates', 'shared', 'utils.js');
let sharedHelpers = '';
if (existsSync(sharedUtilsPath)) {
  const content = readFileSync(sharedUtilsPath, 'utf-8');
  // Extract only the function definitions (skip module.exports block and file header)
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => l.includes('─── Date formatting'));
  const endIdx = lines.findIndex(l => l.includes('─── Exports'));
  if (startIdx !== -1 && endIdx !== -1) {
    sharedHelpers = lines.slice(startIdx, endIdx).join('\n');
  }
}

// ─── 1. Document template ───────────────────────────────────────────────────

const documentTemplate = `/**
 * ${slug}-document.js
 * n8n Code Node — будує документ для послуги "${title}"
 *
 * Вхід:
 *   answers   — об'єкт з відповідями форми (field_id: value)
 *   ai        — об'єкт з відміненими формами від AI (declension fields)
 *
 * Вихід: рядок — готовий текст документа
 *
 * n8n entry point (Code node):
 *   const answers = $('Webhook').first().json.body.answers;
 *   const ai = JSON.parse($('AI Declension').first().json.choices[0].message.content);
 *   const document = ${fnName}(answers, ai);
 *   return [{ json: { document } }];
 */

function ${fnName}(answers, ai) {
  const a = answers;

  // ─── Helpers (from shared/utils.js) ─────────────────────────────────────────
${sharedHelpers}

  // ─── Local wrappers (close over 'a' for convenience) ───────────────────────

  const v = (field, fb) => val(a, field, fb);
  const h = (field) => has(a, field);

  // ─── Base data extraction ──────────────────────────────────────────────────

  // TODO: Extract fields from answers
  // const plaintiffName = [v('last_name'), v('first_name'), v('middle_name')].filter(Boolean).join(' ');

  // ─── Build sections ────────────────────────────────────────────────────────

  const sections = [];

  // --- Header (court + parties) ---
  // TODO: sections.push(\`До \${v('court_name')}\\n...\`);

  // --- Title ---
  // TODO: sections.push('\\nПОЗОВНА ЗАЯВА');
  // TODO: sections.push('про ... \\n');

  // --- Factual part ---
  // TODO: Describe the situation using form answers

  // --- Legal basis ---
  // TODO: Reference relevant law articles
  // sections.push('На підставі ст.ст. ... Сімейного кодексу України, ст.ст. 175, 187 ЦПК України,');

  // --- П Р О Ш У ---
  sections.push('П Р О Ш У:');
  sections.push('');
  // TODO: List specific court requests
  // sections.push('1. ...');

  // --- Attachments ---
  sections.push('');
  sections.push('Додатки:');
  // TODO: List required documents
  // sections.push('1. Копія позовної заяви для відповідача.');

  // --- Signature ---
  sections.push('');
  // TODO: sections.push(\`\${formatDateQuoted(new Date().toISOString().split('T')[0])}         \${plaintiffName}\`);

  return sections.join('\\n');
}
`;

writeFileSync(templatePath, documentTemplate, 'utf-8');
console.log(`  ✅ n8n/templates/${slug}-document.js`);

// ─── 2. Declension prompt ───────────────────────────────────────────────────

const promptPath = join(ROOT, 'n8n', 'prompts', `${slug}-declension-prompt.txt`);
if (!existsSync(promptPath)) {
  // Copy from divorce as starting point
  const divorcePromptPath = join(ROOT, 'n8n', 'prompts', 'divorce-declension-prompt.txt');
  let promptContent;
  if (existsSync(divorcePromptPath)) {
    promptContent = readFileSync(divorcePromptPath, 'utf-8');
    promptContent = `# TODO: Адаптувати промпт для послуги "${title}"\n# Скопійовано з divorce-declension-prompt.txt як відправна точка.\n# Видали або додай поля відмінювання згідно з потребами цієї послуги.\n\n` + promptContent;
  } else {
    promptContent = `# Declension prompt for "${title}"\n# TODO: Define which fields need Ukrainian declension\n`;
  }
  writeFileSync(promptPath, promptContent, 'utf-8');
  console.log(`  ✅ prompts/${slug}-declension-prompt.txt`);
} else {
  console.log(`  ⏭  prompts/${slug}-declension-prompt.txt (already exists)`);
}

// ─── 3. Test fixture ────────────────────────────────────────────────────────

const fixturePath = join(ROOT, 'test-data', slug, 'fixtures', 'scenario-1.mjs');
const fixtureContent = `/**
 * Scenario 1: Базовий кейс — ${title}
 * TODO: Заповнити реальними даними після створення form_config
 */

export const description = 'Базовий кейс: ${title}';

export const answers = {
  // TODO: Fill with form field values
  // last_name: 'Петренко',
  // first_name: 'Оксана',
  // middle_name: 'Іванівна',
};

export const mockAi = {
  // TODO: Fill with expected AI declension output
  // plaintiff_instrumental: 'Петренко Оксаною Іванівною',
  // plaintiff_genitive: 'Петренко Оксани Іванівни',
};
`;
writeFileSync(fixturePath, fixtureContent, 'utf-8');
console.log(`  ✅ test-data/${slug}/fixtures/scenario-1.mjs`);

// ─── 4. .gitkeep for expected/ ──────────────────────────────────────────────

const gitkeepPath = join(ROOT, 'test-data', slug, 'expected', '.gitkeep');
writeFileSync(gitkeepPath, '', 'utf-8');
console.log(`  ✅ test-data/${slug}/expected/.gitkeep`);

// ─── 5. Assertions ──────────────────────────────────────────────────────────

const assertionsPath = join(ROOT, 'test-data', slug, 'assertions.mjs');
const assertionsContent = `/**
 * Structural assertions for "${title}"
 * Used by test-document.mjs to verify document correctness.
 *
 * Format: export default function(answers, doc) => Array<[string, boolean]>
 */
export default function assertions(answers, doc) {
  return [
    // TODO: Add service-specific structural checks
    ['ПОЗОВНА ЗАЯВА присутня',          doc.includes('ПОЗОВНА ЗАЯВА')],
    ['Секція П Р О Ш У',                doc.includes('П Р О Ш У')],
    ['Секція Додатки',                  doc.includes('Додатки:')],
    // ['Прізвище позивача',               doc.includes(answers.last_name)],
    // ['Посилання на закон',              doc.includes('СК України') || doc.includes('ЦПК України')],
  ];
}
`;
writeFileSync(assertionsPath, assertionsContent, 'utf-8');
console.log(`  ✅ test-data/${slug}/assertions.mjs`);

// ─── Done ───────────────────────────────────────────────────────────────────

console.log(`
🎉 Scaffold complete! Next steps:
   1. Create form_config in Admin Panel (Service Builder)
   2. Fill n8n/templates/${slug}-document.js with actual document template
   3. Fill prompts/${slug}-declension-prompt.txt (if declension needed)
   4. Fill test-data/${slug}/fixtures/scenario-1.mjs with test data
   5. Run: npm run test:docs:update -- ${slug}
   6. Review golden files in test-data/${slug}/expected/
   7. Add more scenarios (scenario-2.mjs, scenario-3.mjs)
`);

