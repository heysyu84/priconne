#!/usr/bin/env python3
"""Mirror only image files from PurikoneKrSemi/PurikoneKrSheet.

Preserve original Unicode paths and names. Do not overwrite clan-battle's
existing images, databases or tactics. Produces a searchable manifest and
publishes both the source folder and docs GitHub Pages folder.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
ROOT = Path(__file__).resolve().parents[2]
REPO_URL = "https://github.com/PurikoneKrSemi/PurikoneKrSheet"
OUTPUTS = [
    ROOT / "clan-battle/public/source-library",
    ROOT / "docs/source-library",
]


def group(path: Path) -> str:
    pieces = path.parts
    if pieces[0] == "초상화":
        return "overlays"
    if pieces[0] != "images":
        return "root"
    if len(pieces) == 2:
        return "characters"
    folder = pieces[1].casefold()
    if folder == "original":
        return "original"
    if folder == "nostar":
        return "nostar"
    if folder == "1성":
        return "one-star"
    if folder in {"boss", "abyssboss"}:
        return "boss"
    return "other"


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: import-image-library.py UPSTREAM_CLONE_DIR")
    source = Path(sys.argv[1]).resolve()
    if not (source / "images").is_dir() or not (source / "초상화").is_dir():
        raise SystemExit("Expected both images/ and 초상화/ directories in upstream source")
    upstream_sha = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
    images = []
    for p in sorted(source.rglob("*")):
        if not p.is_file() or p.suffix.casefold() not in IMAGE_EXTS:
            continue
        # No hidden folders, symlinks, scripts, templates or other upstream files.
        if p.is_symlink() or any(part.startswith(".") for part in p.relative_to(source).parts):
            continue
        rel = p.relative_to(source)
        if rel.parts[0] not in {"images", "초상화"} and len(rel.parts) != 1:
            continue
        # Include root-level standalone image files in addition to image folders.
        images.append({
            "path": rel.as_posix(),
            "name": p.stem,
            "filename": p.name,
            "category": group(rel),
            "bytes": p.stat().st_size,
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
        })
    if len(images) < 2000:
        raise SystemExit(f"Upstream source seems incomplete: found only {len(images)} images")
    manifest = {
        "sourceRepository": REPO_URL,
        "sourceCommit": upstream_sha,
        "count": len(images),
        "totalBytes": sum(item["bytes"] for item in images),
        "images": images,
    }
    for dest in OUTPUTS:
        dest.mkdir(parents=True, exist_ok=True)
        for image in images:
            target = dest / image["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists() or target.stat().st_size != image["bytes"]:
                shutil.copy2(source / image["path"], target)
        (dest / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        (dest / "SOURCE.md").write_text(
            "# Source image library\n\n"
            f"Source: {REPO_URL}\n\n"
            f"Source commit: {upstream_sha}\n\n"
            f"Image files: {len(images)} (original names and folders retained)\n\n"
            "Imported as a separate reference library; the clan site's existing "
            "portrait and boss paths were not modified.\n\n"
            "**Rights notice:** The source repository does not provide an "
            "explicit license for redistribution. Game art may be owned by "
            "its respective rights holders; public access alone does not "
            "authorize reuse or republication. Confirm rights before "
            "further publication or redistribution.\n",
            encoding="utf-8",
        )
        print(f"Wrote {len(images)} images to {dest}")
    print(json.dumps({
        "count": len(images), "totalBytes": manifest["totalBytes"],
        "categoryCounts": {cat: sum(1 for img in images if img["category"] == cat)
                          for cat in sorted(set(img["category"] for img in images))}
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
