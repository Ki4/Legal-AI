# -*- coding: utf-8 -*-
"""Pin the render context to the derivation map it claims to implement.

`extract.derived_sources` tells the bridge which template names are "computed, not dead
refs". `build_context` is what actually puts them in the render context. If the two drift,
the bridge green-lights a template that the renderer will then fail on — the failure lands
on a lawyer, not on CI. So: same keys, proven, every run.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from doc_engine import build_context
from doc_engine.extract import derived_sources

TEMPLATES = Path(__file__).resolve().parents[1] / "templates"

ANSWERS = dict(
    case_ref="1/2/26", filing_date="2026-07-15",
    last_name="Петренко", first_name="Олена", middle_name="Іванівна",
    birth_date="1990-05-12", registered_address="вул. Тестова, 1",
    defendant_last_name="Ковальчук", defendant_first_name="Ігор",
    defendant_middle_name="Васильович", defendant_registered_address="вул. Інша, 2",
    defendant_birth_date="1988-11-03",
    has_contract=True, contract_date="2024-03-10", debt_amount="1000",
    claim_type="main", interest_claimed=True, evidence=["Доказ"],
)


@pytest.fixture(scope="module")
def meta() -> dict:
    return json.loads((TEMPLATES / "torture-poc.meta.json").read_text(encoding="utf-8"))


def test_context_provides_exactly_the_declared_derived_keys(meta):
    """The map and the implementation agree — no key declared-but-absent, none extra."""
    field_types = {f["id"]: f.get("type") for f in meta["fields"]}
    declared = set(derived_sources(field_types))
    ctx, _ = build_context(meta, ANSWERS)
    form_ids = set(field_types)
    provided = set(ctx) - form_ids
    assert provided == declared


def test_blank_optional_yields_empty_string_not_missing_key(meta):
    """A guard reads the key, so the key must exist — else preflight kills the guard
    that exists to protect the document."""
    ctx, _ = build_context(meta, dict(ANSWERS, defendant_birth_date=None, contract_date=None))
    assert ctx["defendant_birth_date_words"] == ""
    assert ctx["contract_date_words"] == ""
    assert ctx["defendant_birth_date"] == ""


def test_required_field_left_absent_so_preflight_can_catch_it(meta):
    """Optional gets a default; required must NOT — silence is how "________" was born."""
    answers = {k: v for k, v in ANSWERS.items() if k != "debt_amount"}
    ctx, _ = build_context(meta, answers)
    assert "debt_amount" not in ctx


def test_declension_flags_surface_to_the_caller(meta):
    """A name pymorphy cannot resolve must come back as a flag, never a silent nominative."""
    ctx, flags = build_context(meta, dict(ANSWERS, last_name="Ыъь", middle_name="Іванівна"))
    assert any(f.word == "Ыъь" for f in flags)
    assert all(f.severity in ("high", "low") for f in flags)
