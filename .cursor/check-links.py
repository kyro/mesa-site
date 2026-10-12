#!/usr/bin/env python3
"""Check local HTML and CSS references. Reads the checkout only.

Skips external URLs, fragments, mailto/tel, and data URIs. Does not request
the live site and does not write any files.
"""

from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
HTML_ATTRS = ("href", "src", "poster")
CSS_URL = re.compile(r"url\(\s*['\"]?([^'\")\s]+)['\"]?\s*\)", re.IGNORECASE)


class RefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if value and key.lower() in HTML_ATTRS:
                self.refs.append((key.lower(), value.strip()))


def local_path(raw: str) -> str | None:
    if not raw or raw.startswith(("#", "//", "mailto:", "tel:", "javascript:", "data:")):
        return None
    parsed = urlparse(raw)
    if parsed.scheme:
        return None
    path = unquote(parsed.path)
    if not path:
        return None
    return path


def resolve(page: Path, target: str) -> Path:
    if target.startswith("/"):
        return (ROOT / target.lstrip("/")).resolve()
    return (page.parent / target).resolve()


def exists(path: Path) -> bool:
    if path.is_file():
        return True
    if path.is_dir() and (path / "index.html").is_file():
        return True
    return False


def main() -> int:
    pages = sorted(ROOT.glob("*.html"))
    styles = sorted(ROOT.glob("*.css"))
    missing: list[str] = []
    checked = 0

    for page in pages:
        parser = RefParser()
        parser.feed(page.read_text(encoding="utf-8", errors="replace"))
        for _attr, raw in parser.refs:
            target = local_path(raw)
            if target is None:
                continue
            checked += 1
            dest = resolve(page, target)
            try:
                dest.relative_to(ROOT)
            except ValueError:
                missing.append(f"{page.name}: {raw} (escapes the site root)")
                continue
            if not exists(dest):
                missing.append(f"{page.name}: {raw} (missing file)")

    for sheet in styles:
        for match in CSS_URL.finditer(sheet.read_text(encoding="utf-8", errors="replace")):
            target = local_path(match.group(1))
            if target is None:
                continue
            checked += 1
            dest = resolve(sheet, target)
            try:
                dest.relative_to(ROOT)
            except ValueError:
                missing.append(f"{sheet.name}: {match.group(1)} (escapes the site root)")
                continue
            if not exists(dest):
                missing.append(f"{sheet.name}: {match.group(1)} (missing file)")

    print(f"checked {checked} local references in {len(pages)} html files and {len(styles)} css files")
    if missing:
        print("\n".join(missing))
        return 1
    print("ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
