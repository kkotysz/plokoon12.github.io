#!/usr/bin/env python3
"""
Ingest new photos into assets/photos and _data/gallery.yml.

Rules:
- New photos are files that do NOT match: YYYY-MM-DD_HH-mm-ss[_suffix].jpg
- Each new photo must have EXIF date (DateTimeOriginal or CreateDate)
- Resize original so longer side is <= max-long-side (default: 3008 px)
- Generate thumb at N% of the processed original (default: 10%)
- Rename to YYYY-MM-DD_HH-mm-ss[_suffix].jpg (collision-safe)
- Append to gallery.yml and keep it sorted by filename date
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import yaml

CANONICAL_NAME_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:_[a-z]+)?\.jpe?g$",
    re.IGNORECASE,
)
DATE_FROM_EXIF_RE = re.compile(
    r"(\d{4})[:\-](\d{2})[:\-](\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})"
)
DATE_FROM_FILENAME_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})(?:_([a-z]+))?\.jpe?g$",
    re.IGNORECASE,
)


@dataclass
class PhotoJob:
    source: Path
    target_name: str
    exif_dt: datetime
    desc_seed: str


def run_cmd(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        details = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"Command failed ({' '.join(cmd)}): {details}")
    return result


def check_dependencies() -> None:
    missing = [name for name in ("exiftool", "magick") if shutil.which(name) is None]
    if missing:
        raise RuntimeError(
            "Missing required tools: "
            + ", ".join(missing)
            + ". Install them and rerun."
        )


def is_new_original_file(path: Path) -> bool:
    name = path.name
    if not path.is_file():
        return False
    if path.suffix.lower() not in {".jpg", ".jpeg"}:
        return False
    if name.lower().startswith("thumb_"):
        return False
    return not CANONICAL_NAME_RE.match(name)


def parse_exif_datetime(raw: str | None) -> datetime | None:
    if not raw:
        return None
    match = DATE_FROM_EXIF_RE.search(str(raw).strip())
    if not match:
        return None
    year, month, day, hour, minute, second = map(int, match.groups())
    try:
        return datetime(year, month, day, hour, minute, second)
    except ValueError:
        return None


def identify_dimensions(path: Path) -> tuple[int, int]:
    result = run_cmd(["magick", "identify", "-format", "%w %h", str(path)])
    raw = result.stdout.strip().split()
    if len(raw) != 2:
        return (0, 0)
    try:
        return (int(raw[0]), int(raw[1]))
    except ValueError:
        return (0, 0)


def read_exif_info(path: Path) -> tuple[datetime | None, int, int]:
    result = run_cmd(
        [
            "exiftool",
            "-j",
            "-DateTimeOriginal",
            "-CreateDate",
            "-ImageWidth",
            "-ImageHeight",
            str(path),
        ]
    )
    payload = json.loads(result.stdout)
    if not payload or not isinstance(payload[0], dict):
        return (None, 0, 0)
    info = payload[0]

    dt = parse_exif_datetime(info.get("DateTimeOriginal")) or parse_exif_datetime(
        info.get("CreateDate")
    )
    width = int(info.get("ImageWidth") or 0)
    height = int(info.get("ImageHeight") or 0)
    return (dt, width, height)


def alpha_suffix(index: int) -> str:
    chars: list[str] = []
    n = index
    while True:
        chars.append(chr(ord("a") + (n % 26)))
        n = n // 26 - 1
        if n < 0:
            break
    return "".join(reversed(chars))


def allocate_target_name(base_stem: str, used_names: set[str]) -> str:
    plain = f"{base_stem}.jpg"
    if plain not in used_names:
        used_names.add(plain)
        return plain

    i = 0
    while True:
        candidate = f"{base_stem}_{alpha_suffix(i)}.jpg"
        if candidate not in used_names:
            used_names.add(candidate)
            return candidate
        i += 1


def write_exif_dates(path: Path, dt: datetime) -> None:
    value = dt.strftime("%Y:%m:%d %H:%M:%S")
    run_cmd(
        [
            "exiftool",
            "-overwrite_original",
            f"-DateTimeOriginal={value}",
            f"-CreateDate={value}",
            f"-ModifyDate={value}",
            str(path),
        ]
    )


def resize_original(
    source: Path, target: Path, max_long_side: int, width: int, height: int
) -> bool:
    needs_resize = max(width, height) > max_long_side if width and height else True
    if needs_resize:
        run_cmd(
            [
                "magick",
                str(source),
                "-auto-orient",
                "-resize",
                f"{max_long_side}x{max_long_side}>",
                str(target),
            ]
        )
        if source != target:
            source.unlink()
    else:
        source.rename(target)
    return needs_resize


def create_thumb(source: Path, thumb: Path, percent: int) -> None:
    run_cmd(
        [
            "magick",
            str(source),
            "-auto-orient",
            "-resize",
            f"{percent}%",
            str(thumb),
        ]
    )


def aspect_from_dimensions(width: int, height: int) -> str:
    if width <= 0 or height <= 0:
        return "landscape"
    ratio = width / float(height)
    if ratio >= 2.0:
        return "panorama"
    if ratio <= 0.8:
        return "portrait"
    if 0.95 <= ratio <= 1.05:
        return "square"
    return "landscape"


def filename_sort_key(name: str) -> tuple[str, str, str, str]:
    match = DATE_FROM_FILENAME_RE.match(name.strip())
    if not match:
        return ("9999-99-99", "99-99-99", "zzz", name.lower())
    date_part, time_part, suffix = match.groups()
    return (date_part, time_part, (suffix or "").lower(), name.lower())


def load_gallery(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if data is None:
        return []
    if not isinstance(data, list):
        raise RuntimeError(f"Expected list in {path}, got: {type(data).__name__}")
    return data


def save_gallery(path: Path, entries: list[dict]) -> None:
    payload = yaml.safe_dump(
        entries,
        sort_keys=False,
        allow_unicode=True,
        width=1000,
        default_flow_style=False,
    )
    path.write_text(payload, encoding="utf-8")


def build_new_entries(
    jobs: list[PhotoJob], photos_dir: Path, default_tags: str, default_desc: str
) -> list[dict]:
    entries: list[dict] = []
    for job in jobs:
        target_path = photos_dir / job.target_name
        width, height = identify_dimensions(target_path)
        aspect = aspect_from_dimensions(width, height)
        desc = default_desc if default_desc else job.desc_seed
        entries.append(
            {
                "filename": job.target_name,
                "tags": default_tags,
                "aspect": aspect,
                "desc": desc,
            }
        )
    return entries


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest new JPG photos into gallery.")
    parser.add_argument(
        "--photos-dir",
        default="assets/photos",
        help="Directory with originals and thumbs (default: assets/photos).",
    )
    parser.add_argument(
        "--gallery-yml",
        default="_data/gallery.yml",
        help="Gallery YAML path (default: _data/gallery.yml).",
    )
    parser.add_argument(
        "--max-long-side",
        type=int,
        default=3008,
        help="Max longer side for originals (default: 3008).",
    )
    parser.add_argument(
        "--thumb-percent",
        type=int,
        default=10,
        help="Thumb size in percent of original (default: 10).",
    )
    parser.add_argument(
        "--default-tags",
        default="new",
        help="Tags for newly added entries (default: new).",
    )
    parser.add_argument(
        "--default-desc",
        default="",
        help="Description for newly added entries. Empty means source stem.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned changes only, do not modify files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    photos_dir = Path(args.photos_dir).resolve()
    gallery_yml = Path(args.gallery_yml).resolve()

    if not photos_dir.exists():
        print(f"[ERROR] Photos dir not found: {photos_dir}", file=sys.stderr)
        return 1

    check_dependencies()

    existing_entries = load_gallery(gallery_yml)
    existing_names = {
        str(e.get("filename")).strip()
        for e in existing_entries
        if isinstance(e, dict) and e.get("filename")
    }
    used_names = set(existing_names)
    for path in photos_dir.iterdir():
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg"} and not path.name.lower().startswith("thumb_"):
            used_names.add(path.name)

    candidates = sorted([p for p in photos_dir.iterdir() if is_new_original_file(p)], key=lambda p: p.name.lower())
    print(f"[INFO] New photo candidates: {len(candidates)}")
    if not candidates:
        print("[OK] Nothing to ingest.")
        return 0

    jobs: list[PhotoJob] = []
    missing_date: list[Path] = []

    for source in candidates:
        exif_dt, _, _ = read_exif_info(source)
        if not exif_dt:
            missing_date.append(source)
            continue
        base_stem = exif_dt.strftime("%Y-%m-%d_%H-%M-%S")
        target_name = allocate_target_name(base_stem, used_names)
        jobs.append(
            PhotoJob(
                source=source,
                target_name=target_name,
                exif_dt=exif_dt,
                desc_seed=source.stem,
            )
        )

    if missing_date:
        print(
            f"[WARN] Skipping {len(missing_date)} files without EXIF date "
            "(DateTimeOriginal/CreateDate):"
        )
        for path in missing_date:
            print(f"  - {path.name}")

    if not jobs:
        print("[WARN] No ingestable files found.")
        return 0

    print(f"[INFO] Ready to ingest: {len(jobs)}")
    for job in jobs:
        print(f"  - {job.source.name} -> {job.target_name}")

    if args.dry_run:
        print("[DRY-RUN] No files were changed.")
        return 0

    ingested_jobs: list[PhotoJob] = []
    resized_count = 0

    for job in jobs:
        source = job.source
        target = photos_dir / job.target_name
        thumb = photos_dir / f"thumb_{job.target_name}"

        exif_dt, _, _ = read_exif_info(source)
        if not exif_dt:
            print(f"[WARN] Lost EXIF date before processing, skipped: {source.name}")
            continue

        width, height = identify_dimensions(source)
        did_resize = resize_original(source, target, args.max_long_side, width, height)
        if did_resize:
            resized_count += 1

        write_exif_dates(target, job.exif_dt)
        create_thumb(target, thumb, args.thumb_percent)
        ingested_jobs.append(job)

    if not ingested_jobs:
        print("[WARN] No files ingested due to runtime issues.")
        return 1

    new_entries = build_new_entries(
        ingested_jobs,
        photos_dir,
        default_tags=args.default_tags,
        default_desc=args.default_desc,
    )

    merged_entries = [e for e in existing_entries if isinstance(e, dict)]
    merged_entries.extend(new_entries)
    merged_entries.sort(key=lambda e: filename_sort_key(str(e.get("filename", ""))))
    save_gallery(gallery_yml, merged_entries)

    print("[OK] Ingest complete.")
    print(f"[SUMMARY] ingested={len(ingested_jobs)} resized={resized_count} thumbs={len(ingested_jobs)}")
    print(f"[SUMMARY] gallery_entries={len(merged_entries)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
