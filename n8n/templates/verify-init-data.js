/**
 * verify-init-data.js
 * n8n Code Node — verifies the signed Telegram WebApp `initData` string.
 *
 * Implements Telegram's official Mini App validation algorithm (NOT the
 * separate Login Widget algorithm, which uses a different secret derivation):
 *   secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
 *   hash       = HMAC_SHA256(key=secret_key,    message=data_check_string)
 * where data_check_string is every received field except `hash`, formatted
 * as "key=value" lines sorted alphabetically by key and joined with "\n".
 *
 * Without this check, a client can send an arbitrary `user_id` (#56) and
 * have a document generated/sent under someone else's identity.
 *
 * Query string is parsed by hand (split/decodeURIComponent) instead of the
 * `URLSearchParams` global — n8n's Code node sandbox does not expose it
 * (confirmed live: `ReferenceError: URLSearchParams is not defined`), even
 * though `require('crypto')` and `Buffer` are available.
 *
 * n8n entry point (paste into Code Node):
 *   const botToken = $('Global Config').first().json.TELEGRAM_BOT_TOKEN;
 *   const result = verifyInitData($('Webhook').first().json.body.init_data, botToken);
 *   return [{ json: result }];
 */

const crypto = require('crypto');

function parseQueryString(qs) {
  const out = {};
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    out[key] = value;
  }
  return out;
}

/**
 * @param {string} initData - raw `Telegram.WebApp.initData` query string
 * @param {string} botToken - the bot's token (secret)
 * @param {{ maxAgeSeconds?: number }} [options] - maxAgeSeconds: replay window, default 24h
 * @returns {{ valid: boolean, reason?: string, user?: { id: number, first_name?: string, [k: string]: any } }}
 */
function verifyInitData(initData, botToken, options) {
  const maxAgeSeconds = options && options.maxAgeSeconds != null ? options.maxAgeSeconds : 86400;

  if (!initData) return { valid: false, reason: 'missing' };
  if (!botToken) return { valid: false, reason: 'no_bot_token' };

  let params;
  try {
    params = parseQueryString(initData);
  } catch (_) {
    return { valid: false, reason: 'malformed' };
  }

  const hash = params.hash;
  if (!hash) return { valid: false, reason: 'missing_hash' };

  const pairs = [];
  for (const key of Object.keys(params)) {
    if (key === 'hash') continue;
    pairs.push(key + '=' + params[key]);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const computedBuf = Buffer.from(computedHash, 'hex');
  const givenBuf = Buffer.from(hash, 'hex');
  if (computedBuf.length !== givenBuf.length || !crypto.timingSafeEqual(computedBuf, givenBuf)) {
    return { valid: false, reason: 'bad_signature' };
  }

  const authDate = Number(params.auth_date);
  if (!authDate) return { valid: false, reason: 'missing_auth_date' };
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > maxAgeSeconds) return { valid: false, reason: 'expired' };

  const userRaw = params.user;
  let user = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch (_) {
      return { valid: false, reason: 'malformed_user' };
    }
  }
  if (!user || !user.id) return { valid: false, reason: 'missing_user' };

  return { valid: true, user };
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { verifyInitData };
}
