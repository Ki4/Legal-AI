# -*- coding: utf-8 -*-
"""Build the render context: raw answers + engine-B's computed layer.

`extract.derived_sources` DECLARES which computed keys a template may reference
({{ plaintiff_genitive }}, {{ birth_date_words }}). Until now nothing IMPLEMENTED that
declaration — the PoC built its context ad hoc, so the map and the renderer could drift
apart without a single test noticing. This module is the implementation, and
`test_context.py` pins the two together.

The optional-field rule (why it matters):
- REQUIRED field with no answer  -> key stays ABSENT -> preflight raises. A blank in a
  legal document is a defect, not a blank to fill silently.
- OPTIONAL field with no answer  -> key = "" . Optional means optional; the template is
  expected to guard it (`{%p if contract_date_words %}`), and a guard reads the key, so
  the key must exist or preflight would fail on the very guard that protects it.

This is the structural answer to demo-D7 finding A ("________ року народження" leaking
into ПРОШУ СУД): engine A printed a placeholder for an absent value, engine B either has
the value, or the guarded block disappears, or it refuses to render.
"""
from __future__ import annotations

from typing import Any, Optional

from .dates import date_words
from .declension import Dictionary, LLMFallback, WordFlag, decline_fullname
from .extract import DECLENSION_CASES, PARTY_SOURCES, WORDS_SUFFIX


def build_context(
    meta: dict[str, Any],
    answers: dict[str, Any],
    *,
    dictionary: Optional[Dictionary] = None,
    llm: Optional[LLMFallback] = None,
) -> tuple[dict[str, Any], list[WordFlag]]:
    """Return (render context, declension flags for HITL).

    Flags are never swallowed: an unresolved declension surfaces to the caller so a lawyer
    can review it. Callers must decide what to do with them — this module does not.
    """
    field_types: dict[str, str] = {f["id"]: f.get("type") for f in meta["fields"]}
    optional = {f["id"] for f in meta["fields"] if not f.get("required")}

    ctx: dict[str, Any] = dict(answers)
    flags: list[WordFlag] = []

    # Optional fields the user left blank still need a key — the template guards on it.
    for fid in optional:
        if fid not in ctx or ctx[fid] is None:
            ctx[fid] = ""

    # ── dates in words: <date_field>_words ───────────────────────────────────
    for fid, ftype in field_types.items():
        if ftype != "date":
            continue
        raw = answers.get(fid)
        ctx[f"{fid}{WORDS_SUFFIX}"] = date_words(raw) if raw else ""

    # ── declension: <party>_<case> ───────────────────────────────────────────
    for party, sources in PARTY_SOURCES.items():
        if not all(s in field_types for s in sources):
            continue  # this form carries no name for that party — offer no key
        name = " ".join(str(answers.get(s, "")).strip() for s in sources).strip()
        for case_name, tag in DECLENSION_CASES.items():
            key = f"{party}_{case_name}"
            if not name:
                ctx[key] = ""
                continue
            res = decline_fullname(name, tag, dictionary=dictionary, llm=llm)
            ctx[key] = res.text
            flags.extend(res.flags)

    return ctx, flags
