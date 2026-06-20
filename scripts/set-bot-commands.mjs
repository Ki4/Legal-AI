// set-bot-commands.mjs — register the Telegram slash-command menu (the «/» hint).
// Without this, pressing «/» shows nothing and the user has to guess what to type.
// Idempotent: setMyCommands replaces the whole list each call.
//
//   node scripts/set-bot-commands.mjs
//
// /stop is handled by the "Is Stop?" → "Stop Reply" branch in main-bot
// (sync-bot-stop-command.mjs, IMPROVEMENTS #82).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../apps/client/.env.local'), 'utf8');
const token = env.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m)?.[1].trim();
if (!token) throw new Error('TELEGRAM_BOT_TOKEN not found in apps/client/.env.local');

const commands = [
  { command: 'start', description: 'Почати / головне меню' },
  { command: 'menu', description: 'Показати послуги' },
  { command: 'help', description: 'Допомога' },
  { command: 'stop', description: 'Зупинити (я завжди тут)' },
];

const body = JSON.stringify({ commands });
const req = https.request(
  { hostname: 'api.telegram.org', path: `/bot${token}/setMyCommands`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
  (res) => { let s = ''; res.on('data', (c) => (s += c)); res.on('end', () => console.log('setMyCommands →', s)); },
);
req.on('error', (e) => console.error('error:', e.message));
req.write(body);
req.end();
