#!/usr/bin/env python3
"""
Generate dedicated photo permalink pages from _data/gallery.yml.
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
GALLERY_YML = ROOT / "_data" / "gallery.yml"
OUTPUT_DIR = ROOT / "_pages" / "gallery" / "photo"


def slugify_filename(filename: str) -> str:
    stem = Path(filename).stem.lower()
    slug = re.sub(r"[^a-z0-9_-]+", "-", stem).strip("-")
    return slug or stem or "photo"


def load_gallery(path: Path) -> list[dict]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if data is None:
        return []
    if not isinstance(data, list):
        raise RuntimeError(f"Expected list in {path}, got {type(data).__name__}")
    return [row for row in data if isinstance(row, dict) and row.get("filename")]


def front_matter(row: dict, slug: str) -> str:
    filename = str(row.get("filename", "")).strip()
    desc = str(row.get("desc", "")).strip() or filename
    tags = str(row.get("tags", "")).strip()
    payload = {
        "layout": "gallery-photo",
        "author_profile": False,
        "permalink": f"/gallery/photo/{slug}/",
        "title": desc,
        "photo_file": filename,
        "photo_desc": desc,
        "photo_tags": tags,
        "image": f"/assets/photos/{filename}",
        "og_image": f"/assets/photos/{filename}",
        "sitemap": False,
    }
    dumped = yaml.safe_dump(
        payload,
        sort_keys=False,
        allow_unicode=True,
        width=1000,
        default_flow_style=False,
    )
    return f"---\n{dumped}---\n"


def generate_pages() -> tuple[int, int]:
    entries = load_gallery(GALLERY_YML)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    generated_files: set[str] = set()
    used_slugs: set[str] = set()

    for row in entries:
        filename = str(row.get("filename", "")).strip()
        slug = slugify_filename(filename)
        base_slug = slug
        suffix = 2
        while slug in used_slugs:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        used_slugs.add(slug)

        target = OUTPUT_DIR / f"{slug}.md"
        generated_files.add(target.name)
        target.write_text(front_matter(row, slug), encoding="utf-8")

    removed = 0
    for old in OUTPUT_DIR.glob("*.md"):
        if old.name in generated_files:
            continue
        old.unlink()
        removed += 1

    return len(generated_files), removed


def main() -> int:
    created, removed = generate_pages()
    print(f"[OK] Photo pages generated: {created}")
    print(f"[OK] Removed stale pages: {removed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
