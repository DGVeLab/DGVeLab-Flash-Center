#!/usr/bin/env python3
"""Vendor the pinned esptool-js browser bundle without upgrading its version.

Run in GitHub Actions, not in the browser. Published web files remain unchanged
until the pinned bundle is downloaded, validated and stored in the repository.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
VERSION = "0.7.0"
DEST = ROOT / "vendor" / "esptool-js" / VERSION
BUNDLE = DEST / "bundle.js"
LICENSE = DEST / "LICENSE"
MANIFEST = DEST / "manifest.json"
BUNDLE_URL = f"https://unpkg.com/esptool-js@{VERSION}/bundle.js"
LICENSE_URL = f"https://raw.githubusercontent.com/espressif/esptool-js/v{VERSION}/LICENSE"
EXTERNAL_IMPORT = f'import {{ ESPLoader, Transport }} from "{BUNDLE_URL}";'
LOCAL_IMPORT = f'import {{ ESPLoader, Transport }} from "./vendor/esptool-js/{VERSION}/bundle.js";'


def download(url: str, limit: int = 8 * 1024 * 1024) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "DGVeLab-Flash-Center/vendor-script"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(limit + 1)
    if not data or len(data) > limit:
        raise RuntimeError(f"Missing or unexpectedly large download from {url}")
    return data


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    if BUNDLE.exists():
        data = BUNDLE.read_bytes()
        if not MANIFEST.exists():
            raise RuntimeError("Vendored bundle exists without its verification manifest")
        expected = json.loads(MANIFEST.read_text(encoding="utf-8"))["sha256"]
        if hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError("Vendored bundle checksum differs from its recorded checksum")
    else:
        data = download(BUNDLE_URL)
        if len(data) < 10000 or b"ESPLoader" not in data or b"Transport" not in data:
            raise RuntimeError("Unexpected esptool-js bundle structure")
        BUNDLE.write_bytes(data)
        sha256 = hashlib.sha256(data).hexdigest()
        MANIFEST.write_text(json.dumps({
            "package": "esptool-js", "version": VERSION,
            "source": BUNDLE_URL, "sha256": sha256,
            "upstream": "https://github.com/espressif/esptool-js",
        }, indent=2) + "\n", encoding="utf-8")
        print(f"Vendored esptool-js {VERSION}: {len(data)} bytes, SHA-256 {sha256}")

    if not LICENSE.exists():
        LICENSE.write_bytes(download(LICENSE_URL, 100000))

    flasher = ROOT / "flasher.js"
    js = flasher.read_text(encoding="utf-8")
    if EXTERNAL_IMPORT in js:
        flasher.write_text(js.replace(EXTERNAL_IMPORT, LOCAL_IMPORT, 1), encoding="utf-8")
        print("Switched Flash Center to the local esptool-js bundle")
    elif LOCAL_IMPORT not in js:
        raise RuntimeError("Unknown esptool-js import; leaving website unchanged")

    index = ROOT / "index.html"
    html = index.read_text(encoding="utf-8")
    if "flasher.js?v=0.6.1" in html:
        html = html.replace("flasher.js?v=0.6.1", "flasher.js?v=0.6.2")
        html = html.replace("BETA", "BETA")  # Versioning only; no changes to the interface.
        html = html.replace('class="release">v0.6.1<', 'class="release">v0.6.2<')
        index.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
