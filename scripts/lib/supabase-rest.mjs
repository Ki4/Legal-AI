/**
 * supabase-rest.mjs — minimal Supabase REST client + .env.local loader.
 *
 * Shared by scripts/service-lifecycle.mjs and scripts/check-law-updates.mjs so both
 * talk to Supabase the same way (service_role → bypasses RLS). No dependencies — uses
 * global fetch (Node 18+), so scripts run in CI with zero `npm install`.
 */

import { readFileSync } from 'node:fs';

/**
 * Load KEY=VALUE pairs from a .env.local-style file into process.env (without
 * overwriting values already set in the environment — e.g. CI secrets win).
 */
export function loadEnv(path) {
  try {
    for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i === -1) continue;
      const k = line.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
    }
  } catch {
    /* file may be absent when env is provided externally (CI) */
  }
}

/**
 * Build a tiny REST client bound to a Supabase project + service_role key.
 * @returns {{ sbGet, sbPatch, sbInsert }}
 */
export function createSupabaseClient(url, key) {
  if (!url || !key) {
    throw new Error('createSupabaseClient: missing url or service key');
  }
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  async function sbGet(table, query = '') {
    const res = await fetch(`${url}/rest/v1/${table}?${query}`, { headers });
    if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async function sbPatch(table, query, body) {
    const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${table}: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async function sbInsert(table, row) {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`POST ${table}: ${res.status} ${await res.text()}`);
    return res.json();
  }

  return { sbGet, sbPatch, sbInsert };
}
