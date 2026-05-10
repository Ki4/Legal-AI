// ═══════════════════════════════════════════════════════════════════
// Ensure Profile — Code Node для form-submit v6 workflow
// ═══════════════════════════════════════════════════════════════════
//
// ПРИЗНАЧЕННЯ:
// Гарантує, що для Telegram-користувача існує запис в profiles + identities.
// Виправляє діру: користувач відкрив форму через переслане посилання,
// але ніколи не робив /start у бота → його немає в БД → Insert Case падає.
//
// ЛОГІКА:
//   1. Шукаємо identities WHERE provider='telegram' AND external_id=tg_id
//   2. Якщо знайшли → повертаємо існуючий user_id (profiles.id)
//   3. Якщо ні → створюємо profile + identity → повертаємо новий user_id
//   4. Якщо створення identity провалилось → відкочуємо profile (rollback)
//
// ВИХІД:
//   { user_id: <UUID профілю>, _was_created: <boolean>, _external_id: <string> }
//
// ВСТАНОВЛЕННЯ В n8n:
//   1. Створити Code Node з ім'ям "Ensure Profile"
//   2. Скопіювати ВЕСЬ цей файл (від рядка з "const SUPABASE_URL" і нижче)
//      БЕЗ цього коментаря-заголовка
//   3. Поставити між "Get Service" та "Encrypt Data"
//   4. У "Insert Case" замінити user_id на:
//        {{ $('Ensure Profile').first().json.user_id }}
//   5. Видалити стару ноду "Get Profile" (більше не потрібна)
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = $('Global Config').first().json.SUPABASE_URL;
const SUPABASE_KEY = $('Global Config').first().json.SUPABASE_SERVICE_KEY;
const externalId = String($('Validate').first().json._user_id);
const firstName = $('Validate').first().json._user_first_name || 'Клієнт';

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// ── 1. Шукаємо існуючу identity ─────────────────────────────────────
const searchUrl = `${SUPABASE_URL}/rest/v1/identities`
  + `?provider=eq.telegram`
  + `&external_id=eq.${encodeURIComponent(externalId)}`
  + `&select=user_id`;

const searchRes = await fetch(searchUrl, { headers });
if (!searchRes.ok) {
  const errText = await searchRes.text();
  throw new Error(`[Ensure Profile] Identity lookup failed (${searchRes.status}): ${errText}`);
}
const existing = await searchRes.json();

if (Array.isArray(existing) && existing.length > 0 && existing[0].user_id) {
  console.log('[Ensure Profile] Found existing user:', existing[0].user_id, 'for tg:', externalId);
  return [{ json: {
    user_id: existing[0].user_id,
    _was_created: false,
    _external_id: externalId,
  }}];
}

// ── 2. Не знайдено — створюємо profile ──────────────────────────────
console.log('[Ensure Profile] Creating new profile for tg:', externalId, 'name:', firstName);

const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify({
    full_name: firstName,
    // id, created_at, updated_at, data_retention_consent — defaults у БД
    // (consent зберігається окремо у cases.consented_at)
  }),
});

if (!profileRes.ok) {
  const errText = await profileRes.text();
  throw new Error(`[Ensure Profile] Profile create failed (${profileRes.status}): ${errText}`);
}

const profileData = await profileRes.json();
const newProfile = Array.isArray(profileData) ? profileData[0] : profileData;
const profileId = newProfile?.id;

if (!profileId) {
  throw new Error(`[Ensure Profile] Profile created but no id returned: ${JSON.stringify(profileData)}`);
}

// ── 3. Створюємо identity, що повʼязує telegram_id з новим profile ──
const identityRes = await fetch(`${SUPABASE_URL}/rest/v1/identities`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    user_id: profileId,
    provider: 'telegram',
    external_id: externalId,
  }),
});

if (!identityRes.ok) {
  // Rollback: видаляємо щойно створений profile, щоб не лишалось "висячих" записів
  const rollbackErr = await identityRes.text();
  console.log('[Ensure Profile] Identity create failed, rolling back profile:', profileId);
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileId}`, {
    method: 'DELETE',
    headers,
  }).catch((e) => console.log('[Ensure Profile] Rollback failed:', e.message));
  throw new Error(`[Ensure Profile] Identity create failed (${identityRes.status}): ${rollbackErr}`);
}

console.log('[Ensure Profile] Created new user:', profileId, 'for tg:', externalId);
return [{ json: {
  user_id: profileId,
  _was_created: true,
  _external_id: externalId,
}}];
