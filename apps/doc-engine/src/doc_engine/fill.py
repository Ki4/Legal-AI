# -*- coding: utf-8 -*-
"""Fill a Word template with data via docxtpl.

Template authoring notes (gotchas proven in the PoC):
- Table loops: put {%tr for ...%} and {%tr endfor %} in SEPARATE control rows, with the
  repeated content in a row BETWEEN them. Both in one row -> the row is destroyed
  (docxtpl replaces the whole <w:tr> containing the tag) -> TemplateSyntaxError.
- Do NOT pass a custom StrictUndefined jinja_env together with {%tr%} loops; use preflight
  (missing_fields) instead to catch unfilled placeholders.
"""
from __future__ import annotations

import io

from docxtpl import DocxTemplate

from .preflight import missing_fields


class MissingFieldsError(ValueError):
    def __init__(self, fields: list[str]):
        self.fields = fields
        super().__init__(f"template has unfilled placeholders: {fields}")


def render_to_bytes(template_path: str, context: dict, *, strict: bool = True) -> bytes:
    """Render `template_path` with `context`; return .docx bytes.

    strict=True raises MissingFieldsError if any placeholder lacks a value.
    """
    tpl = DocxTemplate(template_path)
    if strict:
        missing = missing_fields(tpl, context)
        if missing:
            raise MissingFieldsError(missing)
    tpl.render(context)
    buf = io.BytesIO()
    tpl.save(buf)
    return buf.getvalue()
