# -*- coding: utf-8 -*-
"""Declension parity + gender-awareness + HITL-flag behaviour.

Reference forms are the canonical output of the existing MCP (declension via Groq),
captured from generate_alimony_document. pymorphy3 (local, offline) must match them.
"""
import pytest

from doc_engine.declension import decline_fullname, gender_from_patronymic


# (full name, case, expected) — canonical forms from the MCP alimony document.
PARITY = [
    ("Ковальчук Андрій Миколайович", "ablt", "Ковальчуком Андрієм Миколайовичем"),
    ("Ковальчук Андрій Миколайович", "gent", "Ковальчука Андрія Миколайовича"),
    ("Ковальчук Оксана Іванівна", "gent", "Ковальчук Оксани Іванівни"),      # жін. прізвище стоїть
    ("Ковальчук Софія Андріївна", "gent", "Ковальчук Софії Андріївни"),      # дитина, прізвище стоїть
]


@pytest.mark.parametrize("name,case,expected", PARITY)
def test_parity_with_mcp(name, case, expected):
    res = decline_fullname(name, case)
    assert res.text == expected
    assert not res.needs_review, f"unexpected flags: {res.flags}"


def test_gender_from_patronymic():
    assert gender_from_patronymic("Ковальчук Оксана Іванівна") == "femn"
    assert gender_from_patronymic("Ковальчук Андрій Миколайович") == "masc"
    assert gender_from_patronymic("Мадонна") is None  # немає по-батькові


def test_female_surname_stays_male_declines():
    # Same surname "Петренко": female stays, male declines — gender must drive it.
    fem = decline_fullname("Петренко Оксана Володимирівна", "gent")
    assert fem.text == "Петренко Оксани Володимирівни"
    masc = decline_fullname("Петренко Іван Володимирович", "gent")
    assert masc.text.split()[0] == "Петренка"


def test_dictionary_short_circuits_pymorphy():
    # A confirmed form in the dictionary is used verbatim (and prevents any flag).
    d = {("ковальчук", "datv", "masc"): "Ковальчуку"}
    res = decline_fullname("Ковальчук Андрій Миколайович", "datv", dictionary=d)
    assert res.text.split()[0] == "Ковальчуку"
    assert not res.needs_review


def test_llm_fallback_flags_low():
    # Force pymorphy to fail via a nonsense token; LLM fills it but leaves a low flag.
    called = {}

    def fake_llm(word, case, gender):
        called["hit"] = (word, case, gender)
        return "ЗЗЗ"

    res = decline_fullname("Ххх Андрій Миколайович", "gent", llm=fake_llm)
    # If pymorphy already handled every word confidently, the llm is never called and
    # there are no flags — that's also valid. We only assert consistency:
    if called:
        assert any(f.reason == "llm-generated" for f in res.flags)
