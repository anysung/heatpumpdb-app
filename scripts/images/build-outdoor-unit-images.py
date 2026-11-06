#!/usr/bin/env python3
"""Builds the HeatPump DB brand images from the Heatpump Finder set.

Usage: python3 -I scripts/images/build-outdoor-unit-images.py <heatpumpfinder repository>

Every unit is scaled to the same visible area on one floor line, so the brands look
alike in size. Writes public/assets/outdoor-units/v08/ and src/config/outdoorUnits.json.
Bump the version folder when the pictures change: /assets is served as immutable.
"""
import json, math, statistics, sys
from pathlib import Path
from PIL import Image

VERSION = 'v08'
FRAME, FLOOR = 1920, 1852
MAX_W, MAX_H = 1640, 1760
WIDTHS = (400, 800)
# Registered names that the brand spelling table does not fold onto an image brand.
EXTRA_NAMES = {'tcl': ['GD TCL Intelligent Heating & Ventilating Equipment Co., Ltd.'],
               'hitachi': ['Johnson Controls', 'Johnson Controls Hitachi Air Conditioning Europe SAS']}

source = Path(sys.argv[1])
repo = Path(__file__).resolve().parents[2]
out = repo / 'public/assets/outdoor-units' / VERSION
out.mkdir(parents=True, exist_ok=True)
units = json.loads((source / 'src/data/outdoorUnits.gen.json').read_text())
area = lambda u: (u['bounds'][2] - u['bounds'][0]) * (u['bounds'][3] - u['bounds'][1])
target = statistics.median(area(u) for u in units)

config = []
for u in units:
    width = u['widths'][-1]
    im = Image.open(source / f"public/assets/outdoor-units/v07/{u['id']}/{u['id']}__framed__w{width}__v07.webp").convert('RGBA')
    k = width / FRAME
    x0, y0, x1, y1 = u['bounds']
    box_w, box_h = x1 - x0, y1 - y0
    crop = im.crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k)))
    scale = min(math.sqrt(target / area(u)), MAX_W / box_w, MAX_H / box_h)
    for w in WIDTHS:
        f = w / FRAME
        nw, nh = round(box_w * scale * f), round(box_h * scale * f)
        frame = Image.new('RGBA', (w, w), (0, 0, 0, 0))
        frame.alpha_composite(crop.resize((nw, nh), Image.LANCZOS), ((w - nw) // 2, round(FLOOR * f) - nh))
        frame.save(out / f"{u['id']}__w{w}.webp", 'WEBP', quality=84, method=6)
    config.append({'id': u['id'], 'brand': u['brand'], **({'names': EXTRA_NAMES[u['id']]} if u['id'] in EXTRA_NAMES else {})})

(repo / 'src/config/outdoorUnits.json').write_text(json.dumps({'version': VERSION, 'widths': list(WIDTHS), 'units': config}, ensure_ascii=False, indent=2) + '\n')
print(len(config), 'brands', sum(p.stat().st_size for p in out.iterdir()) // 1024, 'KB')
