# Bot off-topic guard + warm clarification — DESIGN (prepared, not implemented)

> **Status:** PREPARED (session 39, 2026-06-19). **Not deployed.** The bot is
> currently used only by Sergey + the lawyer, so there is no real off-topic noise
> or cost pressure yet. Implement when real-user volume appears (or token spend
> from the classifier becomes visible — see IMPROVEMENTS #79).
> Backlog pointer: IMPROVEMENTS #78.

## Problem

Today `main-bot` collapses two very different situations into one «low confidence»
bucket and answers both with the same `Send Help` text:

1. **Vague but on-topic** — «чоловік пішов, не дає на дитину», «не знаю що робити,
   розлучаюсь». The user doesn't know the service name. **This is our ideal user**
   — the AI exists precisely for them. They must be guided warmly, never penalised.
2. **Genuinely off-topic** — погода, жарти, спам, тролінг, образи. This is what we
   guard against: it burns Groq tokens on every message and should be rate-limited.

Conflating them means we either (a) are cold to confused legitimate users, or
(b) keep paying the classifier to «not understand» spam forever.

## Model

The classifier gains a `topic` signal, and the soft-limit counts **only**
`off_topic` — so a confused legitimate user is led longer and warmer, never bounced.

```
clear         → confident service match            → existing flow (Send TWA Button / Ask Confirm)
legal_unclear → legal/family topic, service unclear → WARM clarify, counter NOT incremented
off_topic     → not a legal topic                  → counter++ ; after N → stop + menu, skip AI
```

Two cheap pre-AI guards stay: the regex `Pre-filter` catches obvious junk
(погода/рецепт) for free; the limit is keyed on `off_topic`, not on «unsure which
service».

## 1. Classifier prompt change (AI Agent system message)

Add a third output field. Replace the rules block so it returns:

```json
{ "service_id": <number|null>, "confidence": <0..1>, "topic": "clear" | "legal_unclear" | "off_topic" }
```

`topic` definition to add to the prompt:
- `clear` — чіткий запит на конкретну послугу (confidence ≥ 0.7).
- `legal_unclear` — повідомлення стосується права / сімейних спорів / документів
  до суду, але неясно якої саме послуги (АБО людина розгублена й описує ситуацію).
  Це легітимний користувач — НЕ off_topic.
- `off_topic` — не юридична тема взагалі (погода, розваги, спам, образи, спроби
  потеревенити). Тільки це вважається «не по суті».

> Keep temperature low (the classifier is already deterministic-ish). This is a
> classification field, not free generation — no warmth needed in the JSON itself.

## 2. Soft-limit logic

- **Storage:** `profiles.off_topic_count INT NOT NULL DEFAULT 0` (new migration).
- **On each classified message:**
  - `topic === 'off_topic'` → `off_topic_count += 1`.
  - `topic === 'clear' | 'legal_unclear'` → reset `off_topic_count = 0`
    (good-faith engagement clears the slate).
- **Threshold N = 3** (consecutive off-topic):
  - 1st–2nd off_topic → gentle redirect (text #2 below).
  - ≥ 3rd → **stop message** (text #3) + menu buttons, and **do not call the AI**
    for further messages from this user until they tap a service button or send an
    on-topic message (which resets the counter). This is the real token guard.
- Place a counter read/update + a `Switch (topic)` branch around the existing AI
  Agent → Switch(confidence) path. The `legal_unclear` and stop branches reuse the
  existing `confirm_service_{id}` button wiring — no new routing logic.

## 3. Texts (Ukrainian, warm, STATIC — rotate variants to avoid feeling robotic)

> Decision (session 39): these are **static**, not AI-generated. Generating a reply
> to off-topic burns the very tokens the guard saves, and a legal bot must state its
> scope/service list with zero hallucination. «Dryness» is solved by good copy +
> 2–3 rotating variants, not by the LLM. Buttons reuse the existing service-pick
> callbacks (`confirm_service_1` / `confirm_service_2`).

### 3.1 `legal_unclear` — warm clarify, NO penalty

```
Зрозумів, що ситуація непроста 🤝
Щоб підказати точніше — це ближче до:
[📋 Розлучення та поділ майна]
[💰 Стягнення аліментів]
Або опишіть кількома словами, що сталося — і я зорієнтую вас.
```

### 3.2 `off_topic` 1st–2nd — gentle redirect (rotate 2–3 variants)

```
(A) 🏛️ Я юридичний помічник — готую документи для розлучення та аліментів.
    Якщо ваше питання про це, опишіть ситуацію, і я допоможу ✍️

(B) Тут я допомагаю саме з юридичними документами 📄
    Поки що це розлучення та аліменти. Розкажіть, що у вас — підкажу.
```

### 3.3 `off_topic` after limit (N≥3) — friendly stop + menu

```
Здається, це не те, з чим я можу допомогти 🙏
Я вмію саме юридичні документи — ось що готую зараз:
✅ Розлучення та поділ майна
✅ Аліменти
Оберіть нижче 👇
```
+ inline buttons [📋 Розлучення…] [💰 Аліменти].

### 3.4 Welcome — state scope up front (the «McDonald's» expectation-set)

Welcome New User already lists the active services. Keep one explicit scope line so
a future miss isn't a surprise, e.g.: «Я готую 2 типи документів — розлучення та
аліменти. Інші напрямки поки в розробці.»

## 4. Implementation checklist (when the time comes)

- [ ] Migration: `profiles.off_topic_count`.
- [ ] AI Agent system message → add `topic` field (§1); `Edit Fields` parses it.
- [ ] `Switch` on `topic` (clear / legal_unclear / off_topic) feeding existing
      branches + the new clarify/stop nodes.
- [ ] Counter read (Supabase) before the Switch; increment/reset after.
- [ ] Static text nodes (§3) with 2–3-variant rotation for §3.2.
- [ ] Tie cost visibility to IMPROVEMENTS #79 (each saved AI call = saved Groq spend
      the admin should be able to see).

## Why this is deferred

Only 2 trusted users today → no off-topic noise, no cost pressure, and a wrong
limit would only annoy us. Build the warm/limit logic when there are strangers in
the chat. Until then this doc is the ready-to-implement spec.
