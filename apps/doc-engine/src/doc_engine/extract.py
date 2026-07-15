# -*- coding: utf-8 -*-
"""Extract a service definition's raw material from a Word template.

The `word-to-service` bridge: a lawyer authors ONE .docx (placeholders + {% if %}
branching) plus a metadata blob; this module reads both and prints a single JSON that
`scripts/word-to-service.mjs` turns into a `services` row (→ the MCP tool appears).

What comes from where:
- **variables** — every Jinja name the template references (reuses preflight.declared_variables,
  which docxtpl builds from document.xml + headers/footers). Includes {% if %} guard names.
- **guards** — names referenced inside `{% if %}` tests only. Needed because a guard drives
  document branching, so it must resolve to a form field the interview can actually ask
  (boolean/choice) — enforced by the bridge, not here.
- **metadata** — the lawyer-authored blob: field types/labels/options/show_if/hints. NOT
  derivable from a bare {{ placeholder }}; the Word add-in will write it into the .docx at
  customXml/item1.xml. PoC reads a sidecar `<name>.meta.json` (identical shape).
- **derived** — engine-B computed keys ({{ birth_date_words }}, {{ plaintiff_genitive }}):
  template names that are NOT form fields but which engine B fills from form fields. Emitted
  as key → source-fields so the bridge can tell "computed" apart from "dead reference".

Run:  python -m doc_engine.extract <template.docx> [meta.json]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Iterable

from docx import Document
from docx.oxml import parse_xml
from docxtpl import DocxTemplate
from jinja2 import Environment, nodes

from .preflight import declared_variables

# ── engine-B computed layer ──────────────────────────────────────────────────
# Mirrors what fill.py's caller puts in the render context. This is engine B's OWN
# derivation map — deliberately NOT reused from apps/client serviceAnatomy.ts, whose
# PROVIDED_CONTEXT/DERIVED_SOURCES describe engine A's buildContext (a different engine
# with different keys). Keep in sync with the context builder used at render time.

#: `<party>_<case>` → the name fields it declines. Cases mirror declension.decline_fullname.
DECLENSION_CASES = {
    "genitive": "gent",
    "dative": "datv",
    "accusative": "accs",
    "instrumental": "ablt",
    "locative": "loct",
}
PARTY_SOURCES = {
    "plaintiff": ["last_name", "first_name", "middle_name"],
    "defendant": ["defendant_last_name", "defendant_first_name", "defendant_middle_name"],
}

#: Suffix rule: `<date_field>_words` ← that date field (dates.date_words).
WORDS_SUFFIX = "_words"


def derived_sources(field_types: dict[str, str]) -> dict[str, list[str]]:
    """Engine-B computed key → form fields it derives from, for THIS form.

    `field_types` maps form field id → type (from the metadata blob).
    """
    out: dict[str, list[str]] = {}
    for party, sources in PARTY_SOURCES.items():
        # only offer a declension key if the form actually carries the name parts
        if all(s in field_types for s in sources):
            for case in DECLENSION_CASES:
                out[f"{party}_{case}"] = list(sources)
    for fid, ftype in field_types.items():
        if ftype == "date":
            out[f"{fid}{WORDS_SUFFIX}"] = [fid]
    return out


# ── jinja source / AST ───────────────────────────────────────────────────────
def _jinja_source(tpl: DocxTemplate) -> str:
    """The Jinja source docxtpl itself parses — same construction as
    DocxTemplate.get_undeclared_template_variables (document body + headers + footers)."""
    temp_doc = Document(tpl.template_file)
    xml = tpl.patch_xml(tpl.xml_to_string(temp_doc._element.body))
    for uri in (tpl.HEADER_URI, tpl.FOOTER_URI):
        for _, val in temp_doc._part.rels.items():
            if val.reltype == uri and val.target_part.blob:
                xml += tpl.patch_xml(tpl.xml_to_string(parse_xml(val.target_part.blob)))
    return xml


def guard_variables(tpl: DocxTemplate) -> set[str]:
    """Names referenced inside `{% if %}` / `{% elif %}` tests — the document's branching.

    NB: jinja2's find_all() walks DESCENDANTS only, never the node itself. A bare
    `{% if flag %}` test IS a Name node, so it must be collected explicitly — otherwise
    only compound tests like `{% if x == 'y' %}` (a Compare wrapping a Name) are seen.
    find_all(nodes.If) already yields elif branches, which are nested If nodes.
    """
    ast = Environment().parse(_jinja_source(tpl))
    guards: set[str] = set()
    for if_node in ast.find_all(nodes.If):
        test = if_node.test
        for node in (test, *test.find_all(nodes.Name)):
            if isinstance(node, nodes.Name):
                guards.add(node.name)
    return guards


def _load_metadata(meta_path: Path) -> dict[str, Any]:
    blob = json.loads(meta_path.read_text(encoding="utf-8"))
    for key in ("service", "tabs", "fields"):
        if key not in blob:
            raise ValueError(f"{meta_path.name}: missing required key '{key}'")
    return blob


def extract(template_path: str | Path, meta_path: str | Path | None = None) -> dict[str, Any]:
    """Read a Word template + its metadata blob → the bridge's raw material."""
    template_path = Path(template_path)
    if meta_path is None:
        meta_path = template_path.with_suffix(".meta.json")
    meta = _load_metadata(Path(meta_path))

    tpl = DocxTemplate(str(template_path))
    field_types = {f["id"]: f.get("type") for f in meta["fields"]}

    return {
        "template": template_path.name,
        "variables": sorted(declared_variables(tpl)),
        "guards": sorted(guard_variables(tpl)),
        "derived": derived_sources(field_types),
        "metadata": meta,
    }


def main(argv: Iterable[str]) -> int:
    args = list(argv)
    if not args:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    # Windows consoles default to cp1252 — Ukrainian output dies without this.
    sys.stdout.reconfigure(encoding="utf-8")
    result = extract(args[0], args[1] if len(args) > 1 else None)
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
