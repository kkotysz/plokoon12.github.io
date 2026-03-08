#!/usr/bin/env python3
"""
Fetch EXIF from Flickr for a mapped local JPG file.

Default mode: dry-run (prints what would be written).
Use --write to update the local JPG via exiftool.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request


# Flickr tag name -> ExifTool tag name
TAG_MAP = {
    "Make": "Make",
    "Model": "Model",
    "LensModel": "LensModel",
    "DateTimeOriginal": "DateTimeOriginal",
    "CreateDate": "CreateDate",
    "DateTime": "ModifyDate",
    "ExposureTime": "ExposureTime",
    "FNumber": "FNumber",
    "ISO": "ISO",
    "FocalLength": "FocalLength",
    "FocalLengthIn35mmFormat": "FocalLengthIn35mmFormat",
    "Orientation": "Orientation",
    "Software": "Software",
}


def strip_wrapping_quotes(value: str) -> str:
    value = value.strip()
    if value and value[0] in {'"', "'"}:
        value = value[1:]
    if value and value[-1] in {'"', "'"}:
        value = value[:-1]
    return value


def load_photo_map(path: str) -> dict:
    if not os.path.isfile(path):
        raise RuntimeError(f"Mapping file not found: {path}")

    text = ""
    with open(path, "r", encoding="utf-8") as handle:
        text = handle.read()

    # Optional JSON support: {"1.jpg": "123", ...}
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            mapping = {}
            for key, value in parsed.items():
                key_text = str(key).strip()
                value_text = str(value).strip()
                if key_text and value_text:
                    mapping[key_text] = value_text
            if mapping:
                return mapping
    except json.JSONDecodeError:
        pass

    # Simple line parser for YAML-like maps:
    # 1.jpg: "40701277233"
    # 2.jpg: "48789428626"
    mapping = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue

        key_part, value_part = line.split(":", 1)
        key = strip_wrapping_quotes(key_part.strip())
        value = strip_wrapping_quotes(value_part.strip())
        if not key or not value or value == "{}":
            continue
        mapping[key] = value

    if not mapping:
        raise RuntimeError(f"No mappings found in file: {path}")
    return mapping


def build_flickr_url(api_key: str, photo_id: str) -> str:
    params = {
        "method": "flickr.photos.getExif",
        "api_key": api_key,
        "photo_id": photo_id,
        "format": "json",
        "nojsoncallback": "1",
    }
    return "https://www.flickr.com/services/rest/?" + urllib.parse.urlencode(params)


def fetch_flickr_exif(api_key: str, photo_id: str) -> tuple[dict, int]:
    url = build_flickr_url(api_key, photo_id)
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Flickr HTTP error: {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Flickr connection error: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError("Invalid JSON returned by Flickr") from exc

    if payload.get("stat") != "ok":
        message = payload.get("message", "unknown API error")
        code = payload.get("code", "n/a")
        raise RuntimeError(f"Flickr API error {code}: {message}")

    exif_items = payload.get("photo", {}).get("exif", [])
    by_tag = {}
    for item in exif_items:
        tag = item.get("tag", "").strip()
        if not tag:
            continue
        raw_value = str(item.get("raw", {}).get("_content", "")).strip()
        clean_value = str(item.get("clean", {}).get("_content", "")).strip()
        value = raw_value or clean_value
        by_tag[tag] = value
    return by_tag, len(exif_items)


def normalize_datetime(value: str) -> str:
    # Accepts either YYYY:MM:DD HH:MM:SS or YYYY-MM-DD HH:MM:SS.
    value = value.strip()
    if len(value) >= 10 and value[4] == "-" and value[7] == "-":
        return f"{value[0:4]}:{value[5:7]}:{value[8:10]}{value[10:]}"
    return value


def build_exiftool_updates(flickr_by_tag: dict) -> dict:
    updates = {}
    for flickr_tag, exiftool_tag in TAG_MAP.items():
        value = flickr_by_tag.get(flickr_tag, "").strip()
        if not value:
            continue
        if exiftool_tag in {"DateTimeOriginal", "CreateDate", "ModifyDate"}:
            value = normalize_datetime(value)
        updates[exiftool_tag] = value
    return updates


def run_exiftool_write(local_path: str, updates: dict, keep_backup: bool) -> None:
    cmd = ["exiftool", "-P"]
    if not keep_backup:
        cmd.append("-overwrite_original")
    for tag, value in updates.items():
        cmd.append(f"-{tag}={value}")
    cmd.append(local_path)

    completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        stderr = completed.stderr.strip()
        stdout = completed.stdout.strip()
        details = stderr or stdout or "unknown exiftool error"
        raise RuntimeError(details)


def local_has_datetime(local_path: str) -> bool:
    cmd = ["exiftool", "-j", "-DateTimeOriginal", "-CreateDate", local_path]
    completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        return False
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return False
    if not payload or not isinstance(payload[0], dict):
        return False
    info = payload[0]
    return bool(str(info.get("DateTimeOriginal", "")).strip() or str(info.get("CreateDate", "")).strip())


def natural_filename_key(name: str) -> tuple[int, int | str]:
    match = re.match(r"^(\d+)\.jpg$", name.strip().lower())
    if match:
        return (0, int(match.group(1)))
    return (1, name.lower())


def process_one_file(filename: str, photo_id: str, args: argparse.Namespace) -> tuple[str, str]:
    local_path = os.path.join(args.photos_dir, filename)
    if not os.path.isfile(local_path):
        return ("missing_file", f"[WARN] Local file not found: {local_path}")

    if args.skip_if_has_date and local_has_datetime(local_path):
        return ("skipped_has_date", f"[SKIP] {filename}: local DateTimeOriginal/CreateDate already exists")

    print(f"[INFO] Fetching Flickr EXIF for {filename} (photo_id={photo_id})")
    flickr_by_tag, exif_count = fetch_flickr_exif(args.api_key, photo_id)
    print(f"[INFO] Flickr EXIF entries count: {exif_count}")
    updates = build_exiftool_updates(flickr_by_tag)

    if args.show_all_flickr_tags:
        print("[INFO] Flickr tags fetched:")
        if not flickr_by_tag:
            print("  <none>")
        else:
            for key in sorted(flickr_by_tag.keys()):
                value = flickr_by_tag[key] if flickr_by_tag[key] else "<empty>"
                print(f"  {key}: {value}")

    if not updates:
        if exif_count == 0:
            return ("no_updates", f"[WARN] {filename}: Flickr returned zero EXIF entries")
        return ("no_updates", f"[WARN] {filename}: Flickr returned no mapped EXIF fields for write")

    print("[INFO] Mapped EXIF fields:")
    for key in sorted(updates.keys()):
        print(f"  {key}: {updates[key]}")

    if not args.write:
        return ("dry_run", f"[DRY-RUN] {filename}: no file changes (add --write)")

    run_exiftool_write(local_path, updates, keep_backup=args.keep_backup)
    return ("written", f"[OK] EXIF written to {local_path}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch EXIF from Flickr for mapped photo(s) and optionally write it to local JPG."
    )
    parser.add_argument("--file", help="Single local filename from map, e.g. 1.jpg")
    parser.add_argument("--all", action="store_true", help="Process all files from mapping file")
    parser.add_argument(
        "--map-file",
        required=True,
        help="Path to file with mapping: filename -> Flickr photo_id",
    )
    parser.add_argument("--photos-dir", default="assets/photos", help="Directory with local JPG files")
    parser.add_argument("--api-key", default=os.environ.get("FLICKR_API_KEY", ""), help="Flickr API key")
    parser.add_argument("--write", action="store_true", help="Write EXIF to local JPG using exiftool")
    parser.add_argument("--keep-backup", action="store_true", help="Keep exiftool *_original backup files")
    parser.add_argument(
        "--skip-if-has-date",
        action="store_true",
        help="Skip files that already have DateTimeOriginal/CreateDate in local EXIF (recommended with --all)",
    )
    parser.add_argument("--show-all-flickr-tags", action="store_true", help="Print all Flickr tags fetched")
    args = parser.parse_args()

    try:
        photo_map = load_photo_map(args.map_file)
    except RuntimeError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    if not args.api_key:
        print("[ERROR] Missing API key. Set FLICKR_API_KEY or pass --api-key.", file=sys.stderr)
        return 1

    if args.file and args.all:
        print("[ERROR] Use either --file or --all, not both.", file=sys.stderr)
        return 1
    if not args.file and not args.all:
        print("[ERROR] Provide --file <name> or --all.", file=sys.stderr)
        return 1

    exiftool_check = subprocess.run(
        ["which", "exiftool"], capture_output=True, text=True, check=False
    )
    if exiftool_check.returncode != 0:
        print("[ERROR] exiftool not found in PATH.", file=sys.stderr)
        return 1

    targets: list[tuple[str, str]] = []
    if args.all:
        for name in sorted(photo_map.keys(), key=natural_filename_key):
            photo_id = photo_map.get(name, "").strip()
            if not photo_id:
                continue
            targets.append((name, photo_id))
    else:
        filename = args.file.strip()
        if filename not in photo_map:
            print(f"[ERROR] No Flickr mapping for {filename}.", file=sys.stderr)
            print(f"Known files: {', '.join(sorted(photo_map.keys()))}", file=sys.stderr)
            return 1
        targets.append((filename, photo_map[filename].strip()))

    if not targets:
        print("[WARN] No non-empty photo_id entries found in mapping file.")
        return 0

    counts = {
        "written": 0,
        "dry_run": 0,
        "skipped_has_date": 0,
        "no_updates": 0,
        "missing_file": 0,
        "errors": 0,
    }

    for filename, photo_id in targets:
        try:
            status, message = process_one_file(filename, photo_id, args)
            counts[status] += 1
            print(message)
        except RuntimeError as exc:
            counts["errors"] += 1
            print(f"[ERROR] {filename} ({photo_id}): {exc}", file=sys.stderr)

    print(
        "[SUMMARY] total={total} written={written} dry_run={dry_run} "
        "skipped_has_date={skipped} no_updates={no_updates} missing_file={missing} errors={errors}".format(
            total=len(targets),
            written=counts["written"],
            dry_run=counts["dry_run"],
            skipped=counts["skipped_has_date"],
            no_updates=counts["no_updates"],
            missing=counts["missing_file"],
            errors=counts["errors"],
        )
    )

    return 2 if counts["errors"] else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(2)
