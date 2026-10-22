#!/usr/bin/env python3
"""Synchronize released JoyDeck 1 firmware with the DGVeLab Flash Center catalog.

Invoked by GitHub Actions, not in the browser. Official release assets remain
the source of truth; extracted merged firmware files are cached for GitHub Pages.
Only manual workflow_dispatch triggers are enabled during the pilot.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "firmware" / "catalog.json"
OWNER_REPO = "DGVeLab/JoyDeck"
API = f"https://api.github.com/repos/{OWNER_REPO}/releases?per_page=30"
TAG = re.compile(r"^SW(?P<hub>\d+\.\d+\.\d+)-FW(?P<fw>\d+\.\d+\.\d+)$", re.I)
FIRMWARE = re.compile(r"\.(?:bin|dgv)$", re.I)
ARCHIVE = re.compile(r"\.rar$", re.I)
MAX_BYTES = 8 * 1024 * 1024


def request_json(url):
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "DGVeLab-Flash-Center-Sync/1.0",
    })
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)


def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "DGVeLab-Flash-Center-Sync/1.0"})
    with urllib.request.urlopen(req, timeout=90) as response, path.open("wb") as target:
        while True:
            chunk = response.read(128 * 1024)
            if not chunk:
                break
            target.write(chunk)
            if target.tell() > MAX_BYTES:
                raise ValueError(f"Unexpectedly large firmware asset: {url}")


def extract_archive(archive, location):
    # bsdtar supports RAR unpacking on the Ubuntu runner (libarchive-tools).
    location.mkdir(parents=True, exist_ok=True)
    subprocess.run(["bsdtar", "-xf", str(archive), "-C", str(location)], check=True)
    files = [p for p in location.rglob("*") if p.is_file() and FIRMWARE.search(p.name)]
    if len(files) != 1:
        raise ValueError(f"RAR must contain exactly one firmware .bin/.dgv, found {len(files)}")
    return files[0]


def verify_merged(image):
    if not 0x10020 <= len(image) <= MAX_BYTES:
        raise ValueError(f"Unexpected merged image size: {len(image)}")
    if image[0x1000] != 0xE9 or image[0x10000] != 0xE9:
        raise ValueError("Not a classic ESP32 merged image (missing bootloader/app headers)")
    # We do not make assumptions about NVS preservation.
    return hashlib.sha256(image).hexdigest()


def main():
    releases = request_json(API)
    versions = {}
    # GitHub releases are newest first. Only one Hub pairing per firmware version.
    for rel in releases:
        if rel.get("draft") or rel.get("prerelease"):
            continue
        m = TAG.fullmatch(rel.get("tag_name", ""))
        if not m:
            continue
        version = m.group("fw")
        if version in versions:
            continue
        assets = rel.get("assets", [])
        matches = [a for a in assets if
                   re.search(r"(?:JoyDeck|Firmware).*\.(?:bin|dgv|rar)$", a["name"], re.I)]
        if not matches:
            print("Skipping release without firmware:", rel["tag_name"])
            continue
        # Prefer directly provided merged binaries; otherwise extract the RAR.
        direct = next((a for a in matches if FIRMWARE.search(a["name"])), None)
        asset = direct or next((a for a in matches if ARCHIVE.search(a["name"])), None)
        if asset:
            versions[version] = (rel, asset, m.group("hub"))

    if not versions:
        raise RuntimeError("No compatible JoyDeck 1 release assets found.")

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    project = next((p for p in catalog["projects"] if p["id"] == "joydeck1"), None)
    if project is None:
        project = {
            "id": "joydeck1",
            "name": "JoyDeck 1",
            "chipFamily": "ESP32",
            "description": "Legacy JoyDeck firmware — paired with JoyDeck Hub",
            "status": "available",
            "releases": [],
        }
        catalog["projects"].insert(1, project)

    entries = []
    for version in sorted(versions, key=lambda v: tuple(map(int, v.split("."))), reverse=True):
        rel, asset, hub = versions[version]
        with tempfile.TemporaryDirectory(prefix="joydeck-sync-") as temp:
            folder = Path(temp)
            archive = folder / asset["name"]
            download(asset["browser_download_url"], archive)
            image_path = extract_archive(archive, folder / "extracted") if ARCHIVE.search(asset["name"]) else archive
            image = image_path.read_bytes()
            digest = verify_merged(image)

        path = ROOT / "firmware" / "joydeck1" / version / "firmware-merged.bin"
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            path.write_bytes(image)
        print(f"JD1 {version}: {len(image)} bytes, SHA256 {digest}, Hub {hub}")
        entries.append({
            "version": version,
            "hubVersion": hub,
            "channel": "stable",
            "published": True,
            "sourceRelease": rel["html_url"],
            "sourceTag": rel["tag_name"],
            "parts": [{
                "path": f"./firmware/joydeck1/{version}/firmware-merged.bin",
                "offset": 0,
                "sha256": digest,
            }],
        })

    project["releases"] = entries
    project["status"] = "available"
    CATALOG.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
