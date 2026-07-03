// «Створити з каркаса» (specs/features/template-editor §5): a NON-mandatory
// starting skeleton for services that have no template yet. It mirrors the
// structure of the live divorce/alimony templates — the 8 canonical blocks of a
// позовна заява (blockRegistry, ст.175 ЦПК) with the same style directives and
// the appendices+signature keep-block — so detectBlocks recognizes every block
// and the layout preview shows real integrity relations from the first minute.
//
// ⚠️ The placeholder wording is scaffolding for the lawyer, NOT court-ready
// text: every paragraph must be replaced/approved by Olga before publication
// (session-65 plan: skeleton text → Olga's sign-off list, item 5).
//
// Invariants (guarded by templateSkeleton.test.ts against the REAL engine):
//   • passes the parse gate (renders with empty answers),
//   • detectBlocks finds all 8 canonical blocks in document order,
//   • appendices + signature ride as one keep-together unit.

export const CLAIM_SKELETON = `{{! ═══ Каркас позовної заяви — 8 канонічних блоків (ст.175 ЦПК) ═══ }}
{{! Це заготовка: замініть кожен абзац-заповнювач реальним текстом вашої      }}
{{! послуги. Поля клієнта вставляйте з палітри «Змінні форми» нижче редактора. }}
{{! Текст погоджує юрист ДО публікації.                                        }}
До суду за місцем проживання відповідача
(Знайти ваш суд: https://court.gov.ua/)

Позивач: {{plaintiff_name}}
Зареєстроване місце проживання: ________
Тел.: ________

Відповідач: {{defendant_name}}
Зареєстроване місце проживання: ________


{{!style: center bold keep-with-next}}
ПОЗОВНА ЗАЯВА
{{!style: center}}
про ________ (вкажіть предмет позову)

Опишіть обставини справи: що сталося, коли та за яких умов. Викладайте факти послідовно, кожен важливий факт — окремим абзацом.

Додайте докази, які підтверджують кожну обставину, і поясніть, чому права позивача порушено.

На підставі викладеного та керуючись ст. 4, ст. 175 ЦПК України (замініть на статті законів, на яких ґрунтуються саме ваші вимоги), —

{{!style: center bold keep-with-next}}
П Р О Ш У :

1. Перша вимога до суду — сформулюйте конкретно, що має вирішити суд.

2. Друга вимога до суду (видаліть пункт, якщо не потрібен).

{{!style: keep-block}}
Додатки:
- квитанція про сплату судового збору (оригінал для суду, копія — відповідачу);
- копія паспорта та РНОКПП позивача — 2 примірники;
- 1 екземпляр позовної заяви з копіями доданих документів для відповідача по справі.


«___» _______ 20__ року                                              (підпис)    {{plaintiff_name}}
{{!style: /keep-block}}
`
