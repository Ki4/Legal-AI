# -*- coding: utf-8 -*-
"""Ukrainian date formatting for legal documents."""
from __future__ import annotations

# Genitive month names, as used in "20 червня 2015 року".
_MONTHS_GENT = [
    "січня", "лютого", "березня", "квітня", "травня", "червня",
    "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
]


def date_words(iso: str) -> str:
    """'2015-06-20' -> '20 червня 2015 року'."""
    y, m, d = map(int, iso.split("-"))
    if not 1 <= m <= 12:
        raise ValueError(f"bad month in {iso!r}")
    return f"{d} {_MONTHS_GENT[m - 1]} {y} року"


def date_dmy(iso: str) -> str:
    """'2016-09-01' -> '01.09.2016'."""
    y, m, d = iso.split("-")
    return f"{d}.{m}.{y}"
