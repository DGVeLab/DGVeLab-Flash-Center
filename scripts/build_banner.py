#!/usr/bin/env python3
"""Render the standalone DGVeLab Flash Center banner for the README.

SVG embeds the original PNG logo, so it works offline as a standalone graphic.
PNG is exported at 1400 x 310 pixels for convenient sharing.
"""
from __future__ import annotations

import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCE_LOGO = ASSETS / "dgvelab-logo.png"
OUTPUT_SVG = ASSETS / "dgvelab-flash-center-banner.svg"
OUTPUT_PNG = ASSETS / "dgvelab-flash-center-banner.png"


def make_svg() -> str:
    logo = base64.b64encode(SOURCE_LOGO.read_bytes()).decode("ascii")
    return """<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="1400" height="310" viewBox="0 0 1400 310" role="img"
  aria-label="DGVeLab Flash Center — USB firmware installer for ESP devices">
<defs>
  <radialGradient id="bg" cx="49%" cy="5%" r="96%">
    <stop offset="0%" stop-color="#16539a"/>
    <stop offset="41%" stop-color="#092b60"/>
    <stop offset="100%" stop-color="#07152d"/>
  </radialGradient>
  <linearGradient id="title" x1="0" x2="1" y1="0" y2="0">
    <stop stop-color="#ffffff"/>
    <stop offset="1" stop-color="#d6e4ff"/>
  </linearGradient>
  <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
    <circle cx="11" cy="11" r="1" fill="#92bfff" fill-opacity=".20"/>
  </pattern>
  <linearGradient id="fadeDots"><stop stop-color="white"/><stop offset=".67" stop-color="white" stop-opacity="0"/></linearGradient>
  <mask id="dotMask"><rect width="1400" height="310" fill="url(#fadeDots)"/></mask>
  <clipPath id="round"><rect x="1.5" y="1.5" width="1397" height="307" rx="21"/></clipPath>
  <filter id="shadow"><feGaussianBlur stdDeviation="8"/></filter>
</defs>
<g clip-path="url(#round)">
  <rect width="1400" height="310" fill="url(#bg)"/>
  <rect width="1400" height="310" fill="url(#dots)" mask="url(#dotMask)"/>
  <circle cx="1260" cy="470" r="490" fill="none" stroke="#2c87f8" stroke-opacity=".32" stroke-width="3"/>
  <circle cx="1280" cy="470" r="525" fill="none" stroke="#329aff" stroke-opacity=".10" stroke-width="18" filter="url(#shadow)"/>
  <text x="1002" y="264" fill="#3d82e1" fill-opacity=".20"
    font-family="DejaVu Sans, Arial, sans-serif" font-size="190" font-weight="900" letter-spacing="-16">DGV</text>
  <image x="72" y="62" width="184" height="184"
    xlink:href="data:image/png;base64,""" + logo + """"/>
  <line x1="311" y1="65" x2="311" y2="245" stroke="#78a6e7" stroke-opacity=".42" stroke-width="2"/>
  <text x="355" y="153" fill="url(#title)" font-family="DejaVu Sans, Arial, sans-serif"
    font-size="58" font-weight="700" letter-spacing="-1.5">DGVeLab</text>
  <text x="650" y="153" fill="#a0beff" font-family="DejaVu Sans, Arial, sans-serif"
    font-size="58" font-weight="700" letter-spacing="-1.5">Flash Center</text>
  <text x="357" y="206" fill="#c0d2ef" font-family="DejaVu Sans, Arial, sans-serif"
    font-size="29" font-weight="400">USB firmware installer for ESP devices</text>
</g>
<rect x="1.5" y="1.5" width="1397" height="307" rx="21"
  fill="none" stroke="#2a62ae" stroke-width="2"/>
</svg>
"""


def main() -> None:
    import cairosvg

    ASSETS.mkdir(parents=True, exist_ok=True)
    svg = make_svg()
    OUTPUT_SVG.write_text(svg, encoding="utf-8")
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=str(OUTPUT_PNG))
    print(f"Banner created: {OUTPUT_PNG} ({OUTPUT_PNG.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
