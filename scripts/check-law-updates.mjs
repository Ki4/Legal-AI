#!/usr/bin/env node
/**
 * check-law-updates.mjs
 * Перевіряє зміни законів на zakon.rada.gov.ua для всіх сервісів з watched_laws.
 *
 * Usage:
 *   node scripts/check-law-updates.mjs              # check & update DB
 *   node scripts/check-law-updates.mjs --dry-run    # check only, no DB writes
 *   node scripts/check-law-updates.mjs --notify     # also send Telegram alert
 *
 * Env vars (from .env.local):
 *   VITE_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_KEY — service_role key (bypasses RLS)
 *   TELEGRAM_BOT_TOKEN   — (optional) for --notify
 *   TELEGRAM_ADMIN_CHAT_ID — (optional) for --notify
 *
 * Reuses parsing patterns from seed-divorce-laws.ts
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const NOTIFY  = process.argv.includes('--notify');

// ─── Load .env.local ────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const envFile = readFileSync(join(ROOT, '.env.local'), 'utf-8');
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local might not exist if env vars are set externally
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY');
  console.error('   Set them in .env.local or as environment variables.');
  process.exit(1);
}

// ─── Supabase REST helpers ──────────────────────────────────────────────────

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function supabaseGet(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`Supabase GET ${table}: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

async function supabaseUpdate(table, id, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`Supabase PATCH ${table}/${id}: ${resp.status} ${await resp.text()}`);
}

// ─── Fetch law page & extract revision date ─────────────────────────────────

async function fetchRevisionDate(url) {
  // Use the main page (NOT /print) — "Редакція від DD.MM.YYYY" is only on the main page
  const cleanUrl = url.replace(/\/print\/?$/, '').replace(/\/$/, '');
  const resp = await fetch(cleanUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LegalAI-Bot/1.0)',
      'Accept-Language': 'uk,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${printUrl}`);
  }

  const html = await resp.text();
  return extractVersionDate(html);
}

function extractVersionDate(html) {
  // Priority order: most specific first
  // "Редакція від DD.MM.YYYY" — on main page header (most reliable)
  // "редакція від DD.MM.YYYY" — lowercase variant
  // "станом на DD.MM.YYYY" — alternative phrasing
  // NOTE: do NOT use generic "від DD.MM.YYYY" — it matches the law adoption date!
  const patterns = [
    /[Рр]едакція від (\d{2}\.\d{2}\.\d{4})/,
    /станом на (\d{2}\.\d{2}\.\d{4})/,
    /поточна редакція.*?(\d{2}\.\d{2}\.\d{4})/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const [d, m, y] = match[1].split('.');
      return `${y}-${m}-${d}`;
    }
  }
  return null; // Cannot determine date
}

// ─── Telegram notification ──────────────────────────────────────────────────

async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('  ⚠️  Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID)');
    return;
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    if (resp.ok) {
      console.log('  📤 Telegram alert sent');
    } else {
      console.warn(`  ⚠️  Telegram API error: ${resp.status}`);
    }
  } catch (e) {
    console.warn(`  ⚠️  Telegram send failed: ${e.message}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Legal AI — Law Change Monitor');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE (will update DB)'}`);
  console.log(`   Notify: ${NOTIFY ? 'YES' : 'NO'}`);
  console.log('');

  // 1. Get all services with watched_laws
  const services = await supabaseGet('services', 'select=id,slug,title,watched_laws,needs_law_review&watched_laws=not.is.null&watched_laws=neq.[]');

  if (services.length === 0) {
    console.log('  ℹ️  No services with watched_laws found.');
    return;
  }

  console.log(`  📋 Found ${services.length} service(s) with watched_laws\n`);

  const allChanges = [];

  // 2. Check each service
  for (const service of services) {
    console.log(`  ── ${service.slug} (${service.title}) ──`);

    const laws = service.watched_laws || [];
    let serviceChanged = false;
    const updatedLaws = [];

    for (const law of laws) {
      process.stdout.write(`     ${law.title}... `);

      try {
        const currentDate = await fetchRevisionDate(law.url);

        if (!currentDate) {
          console.log('⚠️  Could not parse date');
          updatedLaws.push(law);
          continue;
        }

        if (currentDate !== law.last_known_date) {
          console.log(`🔴 CHANGED: ${law.last_known_date} → ${currentDate}`);
          serviceChanged = true;
          allChanges.push({
            service: service.slug,
            law: law.title,
            oldDate: law.last_known_date,
            newDate: currentDate,
          });
          updatedLaws.push({ ...law, last_known_date: currentDate });
        } else {
          console.log(`✅ OK (${currentDate})`);
          updatedLaws.push(law);
        }
      } catch (e) {
        console.log(`❌ Error: ${e.message}`);
        updatedLaws.push(law);
      }

      // Small delay between requests to be polite to zakon.rada.gov.ua
      await new Promise(r => setTimeout(r, 1000));
    }

    // 3. Update DB if changes found
    if (serviceChanged && !DRY_RUN) {
      try {
        await supabaseUpdate('services', service.id, {
          watched_laws: updatedLaws,
          needs_law_review: true,
        });
        console.log(`     📝 DB updated: needs_law_review = true`);
      } catch (e) {
        console.error(`     ❌ DB update failed: ${e.message}`);
      }
    }

    console.log('');
  }

  // 4. Summary
  console.log('═'.repeat(60));
  if (allChanges.length === 0) {
    console.log('  ✅ All laws are up to date. No changes detected.');
  } else {
    console.log(`  🔴 ${allChanges.length} law change(s) detected:`);
    for (const c of allChanges) {
      console.log(`     • [${c.service}] ${c.law}: ${c.oldDate} → ${c.newDate}`);
    }

    if (DRY_RUN) {
      console.log('\n  ℹ️  DRY RUN — no DB changes made. Remove --dry-run to update.');
    }

    // 5. Telegram notification
    if (NOTIFY && allChanges.length > 0) {
      const lines = allChanges.map(c =>
        `• <b>${c.service}</b>: ${c.law} (${c.oldDate} → ${c.newDate})`
      );
      const message = `⚠️ <b>Law Change Alert</b>\n\n${lines.join('\n')}\n\nReview needed in admin panel.`;
      await sendTelegramAlert(message);
    }
  }
  console.log('═'.repeat(60));
}

main().catch(e => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
