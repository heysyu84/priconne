#!/usr/bin/env python3
"""Complete the portrait catalog from exact name/image cells in the source XLSX.

Read-only workbook extraction. Existing character records and star variants are
retained unchanged; new records reuse already-extracted original media bytes.
"""

import argparse
import hashlib
import json
import posixpath
import re
import unicodedata
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def source_cells(workbook):
    with ZipFile(workbook) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(item.itertext()) for item in ET.fromstring(
                archive.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        relationships = {item.attrib["Id"]: item.attrib["Target"] for item in
                         ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
        sheets = ET.fromstring(archive.read("xl/workbook.xml")).find("s:sheets", NS)
        sheet = next(item for item in sheets if item.attrib["name"] == "데이터")
        target = relationships[sheet.attrib[REL_ID]]
        part = (target.lstrip("/") if target.startswith("/") else
                posixpath.normpath(posixpath.join("xl", target)))
        cells = {}
        for cell in ET.fromstring(archive.read(part)).findall("s:sheetData/s:row/s:c", NS):
            value = cell.find("s:v", NS)
            raw = value.text if value is not None else None
            if cell.attrib.get("t") == "s":
                raw = strings[int(raw)]
            elif cell.attrib.get("t") == "inlineStr":
                raw = "".join(cell.find("s:is", NS).itertext())
            cells[cell.attrib["r"]] = raw
        return cells


def normalized(name):
    return unicodedata.normalize("NFC", name).strip().casefold()


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--catalog", type=Path, default=root / "public/characters.json")
    parser.add_argument("--manifest", type=Path,
                        default=root / "public/source-library/sheet-provenance.json")
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text())
    manifest = json.loads(args.manifest.read_text())
    workbook_hash = hashlib.sha256(args.workbook.read_bytes()).hexdigest()
    if workbook_hash != manifest["sourceSha256"]:
        raise ValueError("Workbook does not match the extracted image manifest")
    cells = source_cells(args.workbook)
    by_row = {}
    for image in manifest["images"]:
        for reference in image["references"]:
            match = re.fullmatch(r"B([1-9]\d*)", reference["cell"])
            if reference["sheet"] != "데이터" or not match:
                continue
            row = int(match[1])
            if row in by_row:
                raise ValueError(f"More than one portrait at 데이터!B{row}")
            by_row[row] = image
    # Existing Excel names may have been renamed to match the image filenames.
    # Accept old workbook names through preserved aliases rather than duplicating them.
    original = {}
    for character in catalog["characters"]:
        for key in [character["name"], *character.get("aliases", [])]:
            if key in original and original[key]["id"] != character["id"]:
                raise ValueError(f"Conflicting existing name/alias: {key}")
            original[key] = character
    characters = list(catalog["characters"])
    added = 0
    for row, image in sorted(by_row.items()):
        name = cells.get(f"A{row}")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"Missing character name at 데이터!A{row}")
        if name in original:
            if original[name]["source"].get("nameCell") not in (None, f"A{row}"):
                raise ValueError(f"Existing portrait source mismatch for {name}")
            continue
        characters.append({
            "id": f"sheet-row-{row}", "name": name, "aliases": [],
            "portrait": image["portrait"],
            "byStar": {},
            "source": {
                "type": "xlsx-embedded", "sheet": "데이터",
                "nameCell": f"A{row}", "imageCell": f"B{row}",
                "anchor": {"row": row - 1, "column": 1},
                "media": image["originalParts"][0], "sha256": image["sha256"],
            },
            "dimensions": [image["width"], image["height"]], "variants": {},
        })
        added += 1
    names = {}
    for character in characters:
        for name in [character["name"], *character.get("aliases", [])]:
            key = normalized(name)
            if key in names and names[key] != character["id"]:
                raise ValueError(f"Conflicting character name or alias: {name}")
            names[key] = character["id"]
        for url in [character["portrait"], *character["byStar"].values()]:
            path = root / "public" / url.lstrip("/")
            if not path.is_file() or path.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
                raise ValueError(f"Missing or invalid portrait: {url}")
    catalog["version"] = 2
    catalog["characters"] = sorted(characters, key=lambda character: character["name"])
    catalog["catalogSource"] = {
        "workbookSha256": workbook_hash, "sheet": "데이터",
        "nameRange": f"A{min(by_row)}:A{max(by_row)}",
        "imageRange": f"B{min(by_row)}:B{max(by_row)}",
        "characterCount": len(by_row),
    }
    args.catalog.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"characters": len(characters), "added": added,
                      "sourceRows": len(by_row), "unresolved": []}, ensure_ascii=False))


if __name__ == "__main__":
    main()
