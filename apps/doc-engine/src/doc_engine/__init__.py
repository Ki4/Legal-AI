# -*- coding: utf-8 -*-
"""doc-engine: Word-template legal document generation for Ukrainian documents.

Pipeline:  template.docx + data  ->  docxtpl fill (+ declension, dates)  ->  Gotenberg PDF.
"""
from .declension import DeclensionResult, WordFlag, decline_fullname, gender_from_patronymic
from .dates import date_dmy, date_words
from .docx_meta import embed_in_docx, read_from_docx
from .extract import derived_sources, extract, guard_variables, load_metadata
from .fill import MissingFieldsError, render_to_bytes
from .pdf import docx_to_pdf
from .preflight import declared_variables, missing_fields, unused_fields

__all__ = [
    "decline_fullname", "gender_from_patronymic", "DeclensionResult", "WordFlag",
    "date_words", "date_dmy",
    "render_to_bytes", "MissingFieldsError",
    "docx_to_pdf",
    "declared_variables", "missing_fields", "unused_fields",
    # Word-as-authoring-core bridge
    "read_from_docx", "embed_in_docx",
    "extract", "load_metadata", "guard_variables", "derived_sources",
]
