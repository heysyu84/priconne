#!/usr/bin/env python3
"""Extract byte-identical XLSX media, with drawing/cell provenance and no cell data.

Usage: python scripts/extract-sheet-images.py source.xlsx public/images/sheet-originals
"""
import argparse
import hashlib
import io
import json
import posixpath
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image

NS = {
    's': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def natural_key(value):
    return [int(p) if p.isdigit() else p for p in re.split(r'(\d+)', value)]


def cell_name(column, row):
    label = ''
    while column:
        column, tail = divmod(column - 1, 26)
        label = chr(65 + tail) + label
    return label + str(row)


def extract(source, output):
    output.mkdir(parents=True, exist_ok=True)
    refs = defaultdict(list)
    external = []
    with zipfile.ZipFile(source) as z:
        names = set(z.namelist())

        def rels(part):
            folder, filename = posixpath.split(part)
            relpart = posixpath.join(folder, '_rels', filename + '.rels')
            if relpart not in names:
                return {}
            result = {}
            for node in ET.fromstring(z.read(relpart)):
                attrs = dict(node.attrib)
                if attrs.get('TargetMode') != 'External':
                    attrs['part'] = posixpath.normpath(posixpath.join(folder, attrs['Target'])).lstrip('/')
                result[attrs['Id']] = attrs
            return result

        workbook_rels = rels('xl/workbook.xml')
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        image_formula_count = 0
        for sheet in workbook.findall('s:sheets/s:sheet', NS):
            sheet_part = workbook_rels[sheet.attrib['{' + NS['r'] + '}id']]['part']
            sheet_xml = ET.fromstring(z.read(sheet_part))
            image_formula_count += sum(bool(re.search(r'\b(?:IMAGE|DISPIMG)\s*\(', f.text or '', re.I)) for f in sheet_xml.findall('.//s:f', NS))
            for relationship in rels(sheet_part).values():
                if not relationship.get('Type', '').endswith('/drawing'):
                    continue
                drawing = relationship['part']
                if drawing not in names:
                    continue
                drawing_rels = rels(drawing)
                for anchor in ET.fromstring(z.read(drawing)):
                    start = anchor.find('xdr:from', NS)
                    anchor_cell = None
                    if start is not None:
                        anchor_cell = cell_name(int(start.findtext('xdr:col', '0', NS)) + 1, int(start.findtext('xdr:row', '0', NS)) + 1)
                    for blip in anchor.findall('.//a:blip', NS):
                        rid = blip.attrib.get('{' + NS['r'] + '}embed') or blip.attrib.get('{' + NS['r'] + '}link')
                        rel = drawing_rels.get(rid)
                        if not rel or not rel.get('Type', '').endswith('/image'):
                            continue
                        ref = {'sheet': sheet.attrib['name'], 'cell': anchor_cell, 'drawingPart': drawing, 'relationshipId': rid}
                        picture = anchor.find('.//xdr:cNvPr', NS)
                        if picture is not None:
                            ref['drawingImageName'] = picture.attrib.get('name', '')
                        if rel.get('TargetMode') == 'External':
                            external.append({**ref, 'url': rel['Target']})
                        else:
                            refs[rel['part']].append(ref)

        media = sorted((n for n in names if n.startswith('xl/media/') and not n.endswith('/')), key=natural_key)
        images = []
        by_hash = {}
        for original in media:
            data = z.read(original)
            digest = sha256(data)
            with Image.open(io.BytesIO(data)) as im:
                width, height = im.size
                fmt = im.format
                im.verify()
            if digest not in by_hash:
                filename = posixpath.basename(original)
                (output / filename).write_bytes(data)
                item = {
                    'file': filename,
                    'sha256': digest,
                    'sizeBytes': len(data),
                    'width': width,
                    'height': height,
                    'format': fmt,
                    'originalParts': [],
                    'references': [],
                }
                by_hash[digest] = item
                images.append(item)
            item = by_hash[digest]
            item['originalParts'].append(original)
            item['references'].extend(refs[original])
            assert (output / item['file']).read_bytes() == data

        manifest = {
            'version': 1,
            'sourceWorkbook': source.name,
            'sourceSha256': sha256(source.read_bytes()),
            'extraction': 'Original embedded media bytes; no conversion, resizing, worksheet values or roster data.',
            'mediaParts': len(media),
            'uniqueImages': len(images),
            'duplicateParts': len(media) - len(images),
            'totalSizeBytes': sum(i['sizeBytes'] for i in images),
            'drawingReferences': sum(len(i['references']) for i in images),
            'externalImages': external,
            'imageFormulaCount': image_formula_count,
            'unreferencedParts': [n for n in media if not refs[n]],
            'images': images,
        }
        (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({k: v for k, v in manifest.items() if k not in ['images', 'sourceSha256', 'extraction']}, ensure_ascii=False, indent=2))
        print(json.dumps({'sheetReferenceCounts': dict(Counter(r['sheet'] for i in images for r in i['references']))}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    extract(args.source, args.output)
