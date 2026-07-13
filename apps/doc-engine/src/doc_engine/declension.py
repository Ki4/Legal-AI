# -*- coding: utf-8 -*-
"""
Ukrainian full-name declension with a reliability cascade.

Cascade per word:  dictionary  ->  pymorphy3 (gender-aware)  ->  LLM fallback  ->  HITL flag.

The engine NEVER substitutes a declension silently: anything the dictionary/pymorphy/LLM
could not resolve confidently is returned as a flag for lawyer (Olga) review.

Gender is inferred from the patronymic (по батькові), which is reliable in Ukrainian, and
passed to pymorphy3 so masculine/feminine surnames are handled correctly (e.g. a woman's
surname "Петренко" stays, a man's "Ковальчук" declines).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional

import pymorphy3

# One shared analyzer (loading the uk dictionary is expensive).
_morph = pymorphy3.MorphAnalyzer(lang="uk")

# Oblique cases where an unchanged form is suspicious unless the word is indeclinable.
_OBLIQUE = {"gent", "datv", "accs", "ablt", "loct"}

CASE_LABEL = {
    "nomn": "називний", "gent": "родовий", "datv": "давальний",
    "accs": "знахідний", "ablt": "орудний", "loct": "місцевий",
}

# A dictionary of confirmed forms: {(word_lower, case, gender): declined_form}.
# Grows as Olga approves flagged declensions (persisted elsewhere, e.g. Supabase).
Dictionary = dict
# LLM fallback: (word, case, gender) -> declined form or None.
LLMFallback = Callable[[str, str, Optional[str]], Optional[str]]


@dataclass
class WordFlag:
    word: str
    case: str
    reason: str          # "dict-gap" | "llm-generated"
    severity: str        # "high" (unresolved) | "low" (llm, verify)


@dataclass
class DeclensionResult:
    text: str
    flags: list[WordFlag] = field(default_factory=list)

    @property
    def needs_review(self) -> bool:
        return bool(self.flags)


def gender_from_patronymic(fullname: str) -> Optional[str]:
    """Infer gender from по батькові: -вна/-чна -> femn; -вич/-ич -> masc."""
    parts = fullname.split()
    pat = (parts[-1] if len(parts) >= 3 else "").lower()
    if pat.endswith(("вна", "чна")):
        return "femn"
    if pat.endswith(("вич", "ич")):
        return "masc"
    return None


def _restore_caps(word: str, res: str) -> str:
    return res[0].upper() + res[1:] if word[:1].isupper() else res


def _pymorphy_decline(word: str, case: str, gender: Optional[str]) -> tuple[str, bool]:
    """Decline one word. Returns (result, confident)."""
    if not word or not word[0].isalpha():
        return word, True
    parses = _morph.parse(word)
    gmatch = [p for p in parses if (not gender or gender in p.tag)]
    if gender and not gmatch:
        # No parse for the required gender -> dictionary gap, do not guess.
        return word, False
    chosen = gmatch[0] if gmatch else parses[0]
    grams = {case} | ({gender} if gender else set())
    inf = chosen.inflect(grams) or chosen.inflect({case})
    if inf is None:
        return word, False
    res = _restore_caps(word, inf.word)
    # Unchanged in an oblique case is OK only for indeclinable (Fixd) words.
    if case in _OBLIQUE and res.lower() == word.lower():
        return res, ("Fixd" in chosen.tag)
    return res, True


def _decline_word(
    word: str, case: str, gender: Optional[str],
    dictionary: Optional[Dictionary], llm: Optional[LLMFallback],
) -> tuple[str, Optional[WordFlag]]:
    if not word or not word[0].isalpha():
        return word, None
    # 1) dictionary of confirmed forms
    if dictionary is not None:
        hit = dictionary.get((word.lower(), case, gender))
        if hit:
            return _restore_caps(word, hit), None
    # 2) pymorphy3
    res, confident = _pymorphy_decline(word, case, gender)
    if confident:
        return res, None
    # 3) LLM fallback (still flagged low — LLM also errs on rare surnames)
    if llm is not None:
        llm_res = llm(word, case, gender)
        if llm_res:
            return _restore_caps(word, llm_res), WordFlag(word, case, "llm-generated", "low")
    # 4) unresolved -> keep nominative, flag high for HITL
    return res, WordFlag(word, case, "dict-gap", "high")


def decline_fullname(
    name: str, case: str, *,
    dictionary: Optional[Dictionary] = None,
    llm: Optional[LLMFallback] = None,
) -> DeclensionResult:
    """
    Decline a full name 'Прізвище Ім'я По-батькові' into `case`.
    Gender is inferred from the patronymic. Unresolved words are flagged, never silent.
    """
    gender = gender_from_patronymic(name)
    out, flags = [], []
    for w in name.split():
        res, flag = _decline_word(w, case, gender, dictionary, llm)
        out.append(res)
        if flag:
            flags.append(flag)
    return DeclensionResult(" ".join(out), flags)
