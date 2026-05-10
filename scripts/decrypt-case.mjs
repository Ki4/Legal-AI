#!/usr/bin/env node
/**
 * Decrypt case data — for GDPR data access requests.
 *
 * Usage:
 *   ENCRYPTION_KEY=<hex> SUPABASE_URL=<url> SUPABASE_SERVICE_KEY=<key> node scripts/decrypt-case.mjs <case_id>
 *
 * Or with .env.local:
 *   node --env-file=.env.local scripts/decrypt-case.mjs <case_id>
 */

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const caseId = process.argv[2];

if (!caseId) {
  console.error('Usage: node scripts/decrypt-case.mjs <case_id>');
  process.exit(1);
}

if (!ENCRYPTION_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars: ENCRYPTION_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

function decrypt(encryptedString) {
  const parts = encryptedString.split(':');
  if (parts[0] !== 'v1' || parts.length !== 4) {
    throw new Error(`Unsupported format: ${parts[0]}. Expected v1:<iv>:<authTag>:<ciphertext>`);
  }

  const [, ivHex, authTagHex, ciphertext] = parts;
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

async function main() {
  const url = `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}&select=id,user_id,encrypted_data,status,created_at`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!res.ok) {
    console.error(`Supabase error: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const rows = await res.json();
  if (rows.length === 0) {
    console.error(`Case ${caseId} not found`);
    process.exit(1);
  }

  const row = rows[0];
  console.log(`Case: ${row.id}`);
  console.log(`User: ${row.user_id}`);
  console.log(`Status: ${row.status}`);
  console.log(`Created: ${row.created_at}`);
  console.log('---');

  if (!row.encrypted_data) {
    console.log('No encrypted_data found');
    process.exit(0);
  }

  if (row.encrypted_data.startsWith('v1:')) {
    const data = decrypt(row.encrypted_data);
    console.log('Decrypted answers:');
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('Data is not encrypted (plain JSON):');
    console.log(row.encrypted_data);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
