# -*- coding: utf-8 -*-
"""Preflight checks: the template↔data contract.

StrictUndefined can't be used together with docxtpl's {%tr%} table loops, so instead we
check the contract BEFORE rendering: every placeholder in the template must have a value.
A missing field in a legal document is a defect, not a blank to fill silently.
"""
from __future__ import annotations

from docxtpl import DocxTemplate


def declared_variables(tpl: DocxTemplate) -> set[str]:
    """All top-level {{ variables }} the template references (loop vars excluded)."""
    return set(tpl.get_undeclared_template_variables())


def missing_fields(tpl: DocxTemplate, context: dict) -> list[str]:
    """Template placeholders that have no value in `context`."""
    return sorted(v for v in declared_variables(tpl) if v not in context)


def unused_fields(tpl: DocxTemplate, context: dict) -> list[str]:
    """Context keys that no placeholder uses (usually harmless, useful for authoring)."""
    return sorted(k for k in context if k not in declared_variables(tpl))
