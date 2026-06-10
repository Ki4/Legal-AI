/**
 * check-profile.js
 * n8n Code Node — verifies the submitting user has a profile (identity row).
 *
 * Runs right after "Get Profile". A user who opened a forwarded / cached form
 * link without doing /start in the bot has no identity row → no user_id. Without
 * this guard, "Insert Case" later fails on a missing user_id (FK / NOT NULL) and
 * the whole pipeline crashes with no response to the user. This converts that
 * into an explicit, friendly answer telling them to start the bot first.
 *
 * Pairs with `alwaysOutputData: true` on "Get Profile" so this node still runs
 * (and reports _has_profile=false) even when the identities lookup returns zero
 * rows — otherwise n8n would skip the downstream branch on empty input.
 *
 * Mirror of the inline "Check Profile" node. Pure + unit-testable.
 *
 * n8n entry point (paste into Code Node):
 *   const rows = $('Get Profile').all();
 *   const identity = rows.length ? rows[0].json : null;
 *   return [{ json: checkProfile(identity) }];
 */

const NO_PROFILE_MESSAGE =
  'Щоб згенерувати документ, спочатку відкрийте нашого бота в Telegram і натисніть «Старт». ' +
  'Потім поверніться сюди й надішліть форму ще раз.';

/**
 * Decide whether the user has a usable profile.
 *
 * @param {object|null} identity - identities row from "Get Profile" (null if none)
 * @param {string} [identity.user_id] - linked profiles UUID
 * @returns {{ _has_profile: boolean, _user_id: (string|null), _block_message: (string|null) }}
 */
function checkProfile(identity) {
  const userId = identity && identity.user_id;
  if (!userId) {
    return { _has_profile: false, _user_id: null, _block_message: NO_PROFILE_MESSAGE };
  }
  return { _has_profile: true, _user_id: userId, _block_message: null };
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkProfile, NO_PROFILE_MESSAGE };
}
