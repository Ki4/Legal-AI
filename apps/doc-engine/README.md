# doc-engine

Word-template legal document generation for Ukrainian documents. Separate Python service
(does NOT touch the TS `mcp-server` or its `declension.ts`).

Spec: [`specs/features/template-doc-engine/`](../../specs/features/template-doc-engine).

## Pipeline

```
template.docx ({{поля}}, {%tr%} цикл, {%p if%} умова, keep_with_next підпис)
        + data (JSON)
        ↓  docxtpl fill  +  declension (pymorphy3 cascade)  +  dates (uk)
     result.docx
        ↓  Gotenberg (LibreOffice in Docker) — Word NOT on server
     result.pdf
```

## Modules (Phase A — core)

| Module | Role |
|---|---|
| `declension.py` | ПІБ у потрібний відмінок. Каскад: dictionary → pymorphy3 (gender-aware) → LLM → HITL-флаг. Ніколи не підставляє тихо. |
| `dates.py` | Дати прописом: `2015-06-20 → «20 червня 2015 року»`. |
| `fill.py` | docxtpl render + preflight (падає на незаповненому полі). |
| `preflight.py` | Контракт шаблон↔дані: усі `{{поля}}` мають значення. |
| `pdf.py` | docx → PDF через Gotenberg (`GOTENBERG_URL`, дефолт `http://localhost:3000`). |

## Run

```bash
pip install -r requirements.txt
pytest                       # declension parity + dates (offline, no Gotenberg)

# PDF rendering needs a Gotenberg container:
docker run -d --name gotenberg -p 3000:3000 gotenberg/gotenberg:8
```

## Gotchas (proven in PoC, do not repeat)

- `{%tr%}` знищує свій рядок → for/endfor у ОКРЕМИХ контрол-рядках, контент між ними.
- `StrictUndefined` конфліктує з `{%tr%}` → замість нього preflight.
- pymorphy `parse[0]` без роду схибляє мовчки → gender-aware обов'язковий.
- `keep_with_next` перевіряти на Gotenberg-рендері, не на Word.

## Status

Phase A in progress. Next: FastAPI `app.py`, `templates/alimony.docx`, parity-diff test vs MCP.
See spec `plan.md`.
