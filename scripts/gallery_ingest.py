#!/usr/bin/env python3
"""
Ingest new photos into assets/photos and _data/gallery.yml.

Rules:
- New photos are files that do NOT match: YYYY-MM-DD_HH-mm-ss[_suffix].jpg
- Each new photo must have EXIF date (DateTimeOriginal or CreateDate)
- Resize original so longer side is <= max-long-side (default: 3008 px)
- Generate JPG + WEBP + AVIF thumbs
- Rename to YYYY-MM-DD_HH-mm-ss[_suffix].jpg (collision-safe)
- Auto-tag from EXIF location metadata / GPS country inference
- Detect duplicates by SHA1 hash
- Lint tags/descriptions/location metadata before saving
- Keep gallery.yml sorted by filename date
- Refresh static photo permalink pages
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import unicodedata
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
VALID_ASPECTS = {"landscape", "portrait", "square", "panorama"}
KNOWN_COUNTRY_BBOXES: dict[str, tuple[float, float, float, float]] = {
    "poland": (49.0, 55.2, 14.0, 24.2),
    "chile": (-56.0, -17.0, -76.0, -66.0),
    "norway": (57.0, 71.0, 4.0, 32.0),
    "spain": (27.0, 44.5, -19.0, 5.5),
    "italy": (35.0, 48.2, 6.0, 19.0),
    "switzerland": (45.7, 47.9, 5.9, 10.6),
    "ireland": (51.3, 55.5, -10.8, -5.2),
    "uae": (22.5, 26.5, 51.0, 56.7),
    "usa": (18.0, 72.0, -170.0, -65.0),
    "greece": (34.0, 42.5, 19.0, 30.5),
    "korea": (33.0, 39.7, 124.0, 131.0),
    "malta": (35.7, 36.1, 14.1, 14.8),
    "france": (41.0, 51.5, -5.5, 9.8),
}


@dataclass
class ExifInfo:
    dt: datetime | None
    width: int
    height: int
    gps_lat: float | None
    gps_lon: float | None
    country: str
    city: str


@dataclass
class PhotoJob:
    source: Path
    target_name: str
    exif: ExifInfo
    desc_seed: str
    source_sha1: str


def run_cmd(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        details = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"Command failed ({' '.join(cmd)}): {details}")
    return result


def check_dependencies(require_exiftool: bool = True, require_magick: bool = True) -> None:
    required: list[str] = []
    if require_exiftool:
        required.append("exiftool")
    if require_magick:
        required.append("magick")
    missing = [name for name in required if shutil.which(name) is None]
    if missing:
        raise RuntimeError(
            "Missing required tools: "
            + ", ".join(missing)
            + ". Install them and rerun."
        )


def is_original_file(path: Path) -> bool:
    if not path.is_file():
        return False
    if path.suffix.lower() not in {".jpg", ".jpeg"}:
        return False
    return not path.name.lower().startswith("thumb_")


def is_new_original_file(path: Path) -> bool:
    if not is_original_file(path):
        return False
    return not CANONICAL_NAME_RE.match(path.name)


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


def as_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        raw = float(value)
    except (TypeError, ValueError):
        return None
    if raw != raw:  # NaN
        return None
    return raw


def clean_location_text(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return re.sub(r"\s+", " ", text)


def first_non_empty(values: list[object]) -> str:
    for value in values:
        text = clean_location_text(value)
        if text:
            return text
    return ""


def read_exif_info(path: Path) -> ExifInfo:
    result = run_cmd(
        [
            "exiftool",
            "-j",
            "-n",
            "-DateTimeOriginal",
            "-CreateDate",
            "-ImageWidth",
            "-ImageHeight",
            "-GPSLatitude",
            "-GPSLongitude",
            "-Country",
            "-Country-PrimaryLocationName",
            "-City",
            "-Sub-location",
            str(path),
        ]
    )
    payload = json.loads(result.stdout)
    if not payload or not isinstance(payload[0], dict):
        return ExifInfo(None, 0, 0, None, None, "", "")
    info = payload[0]

    dt = parse_exif_datetime(info.get("DateTimeOriginal")) or parse_exif_datetime(
        info.get("CreateDate")
    )
    width = int(info.get("ImageWidth") or 0)
    height = int(info.get("ImageHeight") or 0)
    gps_lat = as_float(info.get("GPSLatitude"))
    gps_lon = as_float(info.get("GPSLongitude"))
    country = first_non_empty(
        [info.get("Country"), info.get("Country-PrimaryLocationName")]
    )
    city = first_non_empty([info.get("City"), info.get("Sub-location")])
    return ExifInfo(dt, width, height, gps_lat, gps_lon, country, city)


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


def create_thumb_jpg(source: Path, thumb: Path, percent: int) -> None:
    run_cmd(
        [
            "magick",
            str(source),
            "-auto-orient",
            "-strip",
            "-resize",
            f"{percent}%",
            str(thumb),
        ]
    )


def create_modern_thumbs(source: Path, thumb_base: Path, percent: int) -> tuple[bool, bool]:
    created_webp = False
    created_avif = False

    webp_path = thumb_base.with_suffix(".webp")
    avif_path = thumb_base.with_suffix(".avif")

    try:
        run_cmd(
            [
                "magick",
                str(source),
                "-auto-orient",
                "-strip",
                "-resize",
                f"{percent}%",
                "-quality",
                "82",
                str(webp_path),
            ]
        )
        created_webp = True
    except RuntimeError as error:
        print(f"[WARN] WEBP thumb failed for {source.name}: {error}")

    try:
        run_cmd(
            [
                "magick",
                str(source),
                "-auto-orient",
                "-strip",
                "-resize",
                f"{percent}%",
                "-quality",
                "55",
                str(avif_path),
            ]
        )
        created_avif = True
    except RuntimeError as error:
        print(f"[WARN] AVIF thumb failed for {source.name}: {error}")

    return (created_webp, created_avif)


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


def normalize_ascii(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text)
    return folded.encode("ascii", "ignore").decode("ascii")


def slugify_tag(text: str) -> str:
    clean = normalize_ascii(text).lower()
    clean = re.sub(r"[^a-z0-9]+", "-", clean)
    clean = clean.strip("-")
    return clean


def parse_tags(raw: str | list[str] | None) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        source = " ".join(str(v) for v in raw)
    else:
        source = str(raw)
    parts = re.split(r"[\s,;/]+", source)
    output: list[str] = []
    for part in parts:
        tag = slugify_tag(part)
        if not tag:
            continue
        if tag in output:
            continue
        output.append(tag)
    return output


def infer_country_from_gps(lat: float | None, lon: float | None) -> str:
    if lat is None or lon is None:
        return ""
    for country, (lat_min, lat_max, lon_min, lon_max) in KNOWN_COUNTRY_BBOXES.items():
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return country
    return ""


def clean_desc(desc: str, fallback: str) -> str:
    normalized = re.sub(r"\s+", " ", str(desc or "").strip())
    return normalized or fallback


def build_tags(
    default_tags: str, aspect: str, exif: ExifInfo, existing_tags: str | list[str] | None = None
) -> str:
    tags = parse_tags(existing_tags) if existing_tags is not None else parse_tags(default_tags)
    if aspect not in tags:
        tags.append(aspect)

    country_tag = slugify_tag(exif.country) if exif.country else ""
    if not country_tag:
        country_tag = infer_country_from_gps(exif.gps_lat, exif.gps_lon)
    if country_tag and country_tag not in tags:
        tags.append(country_tag)

    city_tag = slugify_tag(exif.city) if exif.city else ""
    if city_tag and city_tag not in tags:
        tags.append(city_tag)

    if (exif.gps_lat is not None and exif.gps_lon is not None) and "geo" not in tags:
        tags.append("geo")

    if not tags:
        tags = ["new", aspect]
    return " ".join(tags)


def clean_aspect(raw: object) -> str:
    value = str(raw or "").strip().lower()
    if value in VALID_ASPECTS:
        return value
    return "landscape"


def clean_float(raw: object) -> float | None:
    value = as_float(raw)
    if value is None:
        return None
    return round(value, 6)


def lint_entry(entry: dict) -> dict:
    filename = str(entry.get("filename", "")).strip()
    aspect = clean_aspect(entry.get("aspect"))
    desc_fallback = Path(filename).stem if filename else "Untitled"
    desc = clean_desc(str(entry.get("desc", "")), desc_fallback)

    exif_stub = ExifInfo(
        dt=None,
        width=0,
        height=0,
        gps_lat=clean_float(entry.get("lat")),
        gps_lon=clean_float(entry.get("lon")),
        country=clean_location_text(entry.get("country")),
        city=clean_location_text(entry.get("city")),
    )
    tags = build_tags(
        default_tags="new",
        aspect=aspect,
        exif=exif_stub,
        existing_tags=entry.get("tags"),
    )

    cleaned: dict[str, object] = {
        "filename": filename,
        "tags": tags,
        "aspect": aspect,
        "desc": desc,
    }

    if exif_stub.gps_lat is not None:
        cleaned["lat"] = exif_stub.gps_lat
    if exif_stub.gps_lon is not None:
        cleaned["lon"] = exif_stub.gps_lon
    if exif_stub.country:
        cleaned["country"] = exif_stub.country
    if exif_stub.city:
        cleaned["city"] = exif_stub.city

    for key, value in entry.items():
        if key in {"filename", "tags", "aspect", "desc", "lat", "lon", "country", "city"}:
            continue
        cleaned[key] = value
    return cleaned


def lint_gallery_entries(entries: list[dict]) -> list[dict]:
    output: list[dict] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if not entry.get("filename"):
            continue
        output.append(lint_entry(entry))
    output.sort(key=lambda e: filename_sort_key(str(e.get("filename", ""))))
    return output


def hash_file(path: Path) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def build_hash_index(photos_dir: Path, skip_paths: set[Path]) -> dict[str, str]:
    index: dict[str, str] = {}
    for path in sorted(photos_dir.iterdir(), key=lambda p: p.name.lower()):
        if path in skip_paths:
            continue
        if not is_original_file(path):
            continue
        file_hash = hash_file(path)
        if file_hash not in index:
            index[file_hash] = path.name
    return index


def build_new_entries(
    jobs: list[PhotoJob], photos_dir: Path, default_tags: str, default_desc: str
) -> list[dict]:
    entries: list[dict] = []
    for job in jobs:
        target_path = photos_dir / job.target_name
        width, height = identify_dimensions(target_path)
        aspect = aspect_from_dimensions(width, height)
        desc_seed = clean_desc(job.desc_seed, Path(job.target_name).stem)
        desc = clean_desc(default_desc, desc_seed) if default_desc else desc_seed
        tags = build_tags(default_tags=default_tags, aspect=aspect, exif=job.exif)
        entry: dict[str, object] = {
            "filename": job.target_name,
            "tags": tags,
            "aspect": aspect,
            "desc": desc,
        }
        if job.exif.gps_lat is not None:
            entry["lat"] = round(job.exif.gps_lat, 6)
        if job.exif.gps_lon is not None:
            entry["lon"] = round(job.exif.gps_lon, 6)
        if job.exif.country:
            entry["country"] = clean_location_text(job.exif.country)
        if job.exif.city:
            entry["city"] = clean_location_text(job.exif.city)
        entries.append(entry)
    return entries


def sync_photo_pages(script_dir: Path) -> None:
    generator = script_dir / "generate_photo_pages.py"
    if not generator.exists():
        print("[WARN] generate_photo_pages.py not found, skipped permalink sync.")
        return
    run_cmd([sys.executable, str(generator)])


def backfill_modern_thumbs(
    entries: list[dict], photos_dir: Path, thumb_percent: int, force_rebuild: bool
) -> tuple[int, int]:
    webp_count = 0
    avif_count = 0
    for entry in entries:
        filename = str(entry.get("filename", "")).strip()
        if not filename:
            continue
        source = photos_dir / filename
        if not source.exists():
            continue
        stem = Path(filename).stem
        thumb_base = photos_dir / f"thumb_{stem}"
        webp_path = thumb_base.with_suffix(".webp")
        avif_path = thumb_base.with_suffix(".avif")
        if not force_rebuild and webp_path.exists() and avif_path.exists():
            continue

        made_webp, made_avif = create_modern_thumbs(source, thumb_base, thumb_percent)
        if made_webp:
            webp_count += 1
        if made_avif:
            avif_count += 1
    return (webp_count, avif_count)


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
        "--disable-duplicate-check",
        action="store_true",
        help="Disable SHA1 duplicate detection against existing originals.",
    )
    parser.add_argument(
        "--no-modern-thumbs",
        action="store_true",
        help="Skip WEBP/AVIF thumb generation for ingested files.",
    )
    parser.add_argument(
        "--rebuild-modern-thumbs",
        action="store_true",
        help="Generate/refresh WEBP+AVIF thumbs for all gallery entries.",
    )
    parser.add_argument(
        "--skip-photo-pages",
        action="store_true",
        help="Skip syncing static photo permalink pages.",
    )
    parser.add_argument(
        "--lint-only",
        action="store_true",
        help="Only lint gallery.yml (and optionally rebuild modern thumbs/pages).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned changes only, do not modify files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    photos_dir = Path(args.photos_dir).resolve()
    gallery_yml = Path(args.gallery_yml).resolve()

    if not photos_dir.exists():
        print(f"[ERROR] Photos dir not found: {photos_dir}", file=sys.stderr)
        return 1

    existing_entries = load_gallery(gallery_yml)
    existing_names = {
        str(e.get("filename")).strip()
        for e in existing_entries
        if isinstance(e, dict) and e.get("filename")
    }

    if args.lint_only:
        check_dependencies(
            require_exiftool=False,
            require_magick=args.rebuild_modern_thumbs,
        )
        linted = lint_gallery_entries([e for e in existing_entries if isinstance(e, dict)])
        if args.dry_run:
            print(f"[DRY-RUN] lint-only: entries={len(linted)}")
            return 0
        save_gallery(gallery_yml, linted)
        webp_count = 0
        avif_count = 0
        if args.rebuild_modern_thumbs:
            webp_count, avif_count = backfill_modern_thumbs(
                linted, photos_dir, args.thumb_percent, force_rebuild=True
            )
        if not args.skip_photo_pages:
            sync_photo_pages(script_dir)
        print("[OK] Lint complete.")
        print(f"[SUMMARY] gallery_entries={len(linted)} webp={webp_count} avif={avif_count}")
        return 0

    check_dependencies(require_exiftool=True, require_magick=True)

    used_names = set(existing_names)
    for path in photos_dir.iterdir():
        if is_original_file(path):
            used_names.add(path.name)

    candidates = sorted(
        [p for p in photos_dir.iterdir() if is_new_original_file(p)],
        key=lambda p: p.name.lower(),
    )
    print(f"[INFO] New photo candidates: {len(candidates)}")
    if not candidates:
        if args.rebuild_modern_thumbs:
            linted = lint_gallery_entries([e for e in existing_entries if isinstance(e, dict)])
            if not args.dry_run:
                save_gallery(gallery_yml, linted)
                webp_count, avif_count = backfill_modern_thumbs(
                    linted, photos_dir, args.thumb_percent, force_rebuild=True
                )
                if not args.skip_photo_pages:
                    sync_photo_pages(script_dir)
                print("[OK] Nothing to ingest, rebuilt modern thumbs only.")
                print(
                    f"[SUMMARY] gallery_entries={len(linted)} webp={webp_count} avif={avif_count}"
                )
                return 0
            print("[DRY-RUN] Nothing to ingest.")
            return 0

        print("[OK] Nothing to ingest.")
        return 0

    skip_paths = set(candidates)
    existing_hashes: dict[str, str] = {}
    if not args.disable_duplicate_check:
        print("[INFO] Building hash index for duplicate detection...")
        existing_hashes = build_hash_index(photos_dir, skip_paths=skip_paths)

    jobs: list[PhotoJob] = []
    missing_date: list[Path] = []
    duplicate_files: list[tuple[str, str]] = []
    seen_candidate_hashes: dict[str, str] = {}

    for source in candidates:
        exif = read_exif_info(source)
        if not exif.dt:
            missing_date.append(source)
            continue

        source_hash = hash_file(source)
        if source_hash in seen_candidate_hashes:
            duplicate_files.append((source.name, seen_candidate_hashes[source_hash]))
            continue
        seen_candidate_hashes[source_hash] = source.name

        if existing_hashes and source_hash in existing_hashes:
            duplicate_files.append((source.name, existing_hashes[source_hash]))
            continue

        base_stem = exif.dt.strftime("%Y-%m-%d_%H-%M-%S")
        target_name = allocate_target_name(base_stem, used_names)
        jobs.append(
            PhotoJob(
                source=source,
                target_name=target_name,
                exif=exif,
                desc_seed=source.stem,
                source_sha1=source_hash,
            )
        )

    if missing_date:
        print(
            f"[WARN] Skipping {len(missing_date)} files without EXIF date "
            "(DateTimeOriginal/CreateDate):"
        )
        for path in missing_date:
            print(f"  - {path.name}")

    if duplicate_files:
        print(f"[WARN] Skipping {len(duplicate_files)} duplicate files:")
        for duplicate_name, existing_name in duplicate_files:
            print(f"  - {duplicate_name} (duplicate of {existing_name})")

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
    webp_count = 0
    avif_count = 0

    for job in jobs:
        source = job.source
        target = photos_dir / job.target_name
        thumb_jpg = photos_dir / f"thumb_{job.target_name}"
        thumb_base = photos_dir / f"thumb_{Path(job.target_name).stem}"

        exif = read_exif_info(source)
        if not exif.dt:
            print(f"[WARN] Lost EXIF date before processing, skipped: {source.name}")
            continue

        width, height = identify_dimensions(source)
        did_resize = resize_original(source, target, args.max_long_side, width, height)
        if did_resize:
            resized_count += 1

        write_exif_dates(target, job.exif.dt)
        create_thumb_jpg(target, thumb_jpg, args.thumb_percent)
        if not args.no-modern-thumbs:
            made_webp, made_avif = create_modern_thumbs(target, thumb_base, args.thumb_percent)
            if made_webp:
                webp_count += 1
            if made_avif:
                avif_count += 1

        # Refresh EXIF data after resize/orient operations.
        updated_exif = read_exif_info(target)
        if updated_exif.dt is None:
            updated_exif.dt = job.exif.dt
        if not updated_exif.country:
            updated_exif.country = job.exif.country
        if not updated_exif.city:
            updated_exif.city = job.exif.city
        if updated_exif.gps_lat is None:
            updated_exif.gps_lat = job.exif.gps_lat
        if updated_exif.gps_lon is None:
            updated_exif.gps_lon = job.exif.gps_lon

        ingested_jobs.append(
            PhotoJob(
                source=target,
                target_name=job.target_name,
                exif=updated_exif,
                desc_seed=job.desc_seed,
                source_sha1=job.source_sha1,
            )
        )

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
    linted_entries = lint_gallery_entries(merged_entries)
    save_gallery(gallery_yml, linted_entries)

    rebuilt_webp = 0
    rebuilt_avif = 0
    if args.rebuild_modern_thumbs:
        rebuilt_webp, rebuilt_avif = backfill_modern_thumbs(
            linted_entries, photos_dir, args.thumb_percent, force_rebuild=True
        )

    if not args.skip_photo_pages:
        sync_photo_pages(script_dir)

    print("[OK] Ingest complete.")
    print(
        "[SUMMARY] "
        f"ingested={len(ingested_jobs)} resized={resized_count} "
        f"thumb_jpg={len(ingested_jobs)} webp={webp_count + rebuilt_webp} avif={avif_count + rebuilt_avif}"
    )
    print(f"[SUMMARY] gallery_entries={len(linted_entries)} duplicates_skipped={len(duplicate_files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
