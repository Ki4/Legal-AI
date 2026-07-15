# -*- coding: utf-8 -*-
"""Service metadata stored INSIDE the .docx — making the Word file self-contained.

Why this exists: a bare {{ placeholder }} carries only a name. Field type, label, options,
show_if, hints — none of it is derivable from the template text, yet all of it is needed to
build the form/tool. Keeping it in a sidecar file means "the Word doc" is really two files a
lawyer can separate, rename, or email apart. Embedding it makes the .docx the single artifact
the whole service is authored in — which is the point of "Word is the core".

Where it lives: a .docx is a zip; Office stores arbitrary XML at `customXml/itemN.xml`,
declared via `[Content_Types].xml` + a relationship from `word/document.xml`. Word round-trips
unknown custom XML parts untouched, so a lawyer can edit and re-save the template without
losing the blob. This is exactly the store a Word task-pane add-in writes through
(`Office.context.document.customXmlParts`), so the PoC and the future add-in share one format.

We wrap the JSON in CDATA under our own namespace rather than mapping every field to XML
elements: the blob's schema is the FormConfig contract, which already lives in TypeScript —
one JSON payload keeps the two from drifting.
"""
from __future__ import annotations

import json
import posixpath
import re
import shutil
import zipfile
from pathlib import Path
from typing import Any, Optional

#: Our custom XML namespace — how we recognise OUR part among any others Word may store.
NS = "urn:legal-ai:service-meta:1"
ROOT_TAG = "serviceMeta"

_CUSTOM_XML_RE = re.compile(r"^customXml/item(\d+)\.xml$")
_CT_OVERRIDE = '<Override PartName="/customXml/item{n}.xml" ContentType="application/xml"/>'
_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml"
_PROPS_CT = (
    "application/vnd.openxmlformats-officedocument.customXmlProperties+xml"
)


def _part_xml(meta: dict[str, Any]) -> str:
    payload = json.dumps(meta, ensure_ascii=False, indent=1)
    # ']]>' would close the CDATA early; the standard split-and-rejoin escape.
    payload = payload.replace("]]>", "]]]]><![CDATA[>")
    return f'<{ROOT_TAG} xmlns="{NS}"><![CDATA[{payload}]]></{ROOT_TAG}>'


def _props_xml(item_id: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<ds:datastoreItem xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml" '
        f'ds:itemID="{{{item_id}}}">'
        f'<ds:schemaRefs><ds:schemaRef ds:uri="{NS}"/></ds:schemaRefs>'
        "</ds:datastoreItem>"
    )


def read_from_docx(path: str | Path) -> Optional[dict[str, Any]]:
    """Return the embedded metadata blob, or None if this .docx carries none."""
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if not _CUSTOM_XML_RE.match(name):
                continue
            text = z.read(name).decode("utf-8")
            if NS not in text:
                continue  # some other add-in's custom XML — not ours
            start = text.find("<![CDATA[")
            end = text.rfind("]]>")
            if start == -1 or end == -1:
                continue
            payload = text[start + len("<![CDATA[") : end].replace("]]]]><![CDATA[>", "]]>")
            return json.loads(payload)
    return None


def embed_in_docx(src: str | Path, meta: dict[str, Any], dst: str | Path | None = None) -> Path:
    """Write `meta` into `src` as a custom XML part. Replaces our part if already present.

    zipfile cannot delete/replace entries in place, so the archive is rebuilt — which is also
    what keeps [Content_Types].xml and the document rels consistent.
    """
    src = Path(src)
    dst = Path(dst) if dst else src
    existing = read_from_docx(src)

    with zipfile.ZipFile(src) as z:
        names = z.namelist()
        # reuse our slot if we already wrote one, else take the next free index
        ours = None
        for name in names:
            m = _CUSTOM_XML_RE.match(name)
            if m and NS in z.read(name).decode("utf-8"):
                ours = int(m.group(1))
                break
        used = {int(m.group(1)) for m in map(_CUSTOM_XML_RE.match, names) if m}
        idx = ours if ours is not None else (max(used) + 1 if used else 1)

        item = f"customXml/item{idx}.xml"
        props = f"customXml/itemProps{idx}.xml"
        rel_id = f"rIdServiceMeta{idx}"

        payload = {n: z.read(n) for n in names}

    # ── [Content_Types].xml: declare both parts ─────────────────────────────
    ct = payload["[Content_Types].xml"].decode("utf-8")
    if f'PartName="/{item}"' not in ct:
        ct = ct.replace("</Types>", _CT_OVERRIDE.format(n=idx) + "</Types>")
    if f'PartName="/{props}"' not in ct:
        ct = ct.replace(
            "</Types>",
            f'<Override PartName="/{props}" ContentType="{_PROPS_CT}"/></Types>',
        )
    payload["[Content_Types].xml"] = ct.encode("utf-8")

    # ── word/_rels/document.xml.rels: point the document at the part ────────
    rels_name = "word/_rels/document.xml.rels"
    rels = payload[rels_name].decode("utf-8")
    if rel_id not in rels:
        target = posixpath.relpath(item, "word")  # ../customXml/itemN.xml
        rels = rels.replace(
            "</Relationships>",
            f'<Relationship Id="{rel_id}" Type="{_REL_TYPE}" Target="{target}"/></Relationships>',
        )
        payload[rels_name] = rels.encode("utf-8")

    payload[item] = _part_xml(meta).encode("utf-8")
    payload[props] = _props_xml(f"5C4A1B2E-0000-4000-8000-{idx:012d}").encode("utf-8")

    tmp = dst.with_suffix(".tmp.docx")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
        for name, data in payload.items():
            out.writestr(name, data)
    shutil.move(str(tmp), str(dst))

    _ = existing  # kept for callers that want to diff; intentionally unused
    return dst
