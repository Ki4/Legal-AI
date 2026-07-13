# -*- coding: utf-8 -*-
"""Render .docx -> PDF via a Gotenberg container (LibreOffice under the hood).

Word is NOT installed on the server (impossible on Linux + licensing). Gotenberg's
LibreOffice respects keep_with_next identically to Word (verified in the PoC pagination test).
"""
from __future__ import annotations

import os
import urllib.request

DEFAULT_GOTENBERG = os.environ.get("GOTENBERG_URL", "http://localhost:3000")
_CONVERT_PATH = "/forms/libreoffice/convert"
_DOCX_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def docx_to_pdf(docx_bytes: bytes, filename: str = "document.docx",
                gotenberg_url: str = DEFAULT_GOTENBERG, timeout: int = 120) -> bytes:
    """POST a .docx to Gotenberg and return the resulting PDF bytes."""
    boundary = "----docengineboundary"
    body = (
        f"--{boundary}\r\n".encode()
        + f'Content-Disposition: form-data; name="files"; filename="{filename}"\r\n'.encode()
        + f"Content-Type: {_DOCX_CT}\r\n\r\n".encode()
        + docx_bytes
        + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(
        gotenberg_url.rstrip("/") + _CONVERT_PATH,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()
