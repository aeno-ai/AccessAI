"""For each of our ASL word labels, list WLASL's YouTube source videos and check
which still exist and can be embedded (YouTube oEmbed: 200 = OK, 401/403 =
embedding off, 404/400 = gone). Writes asl_youtube.csv and prints a summary.
Usage: python -I wlasl_youtube_check.py <WLASL_v0.3.json> <ai/models/sign/asl/words/labels.json> <out.csv>
"""
import csv
import json
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

wlasl_path, labels_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(wlasl_path, encoding='utf-8'))
labels = list(json.load(open(labels_path, encoding='utf-8')).values())

YT = re.compile(r'(?:youtube\.com/(?:watch\?v=|embed/|v/)|youtu\.be/)([A-Za-z0-9_-]{11})')
by_gloss = {g['gloss']: g['instances'] for g in data}

rows = []
for label in labels:
    for inst in by_gloss.get(label, []):
        m = YT.search(inst.get('url', ''))
        if not m:
            continue
        fps = inst.get('fps') or 25
        fs, fe = inst.get('frame_start', 1), inst.get('frame_end', -1)
        rows.append({
            'label': label,
            'youtube_id': m.group(1),
            'start_s': round((fs - 1) / fps, 2),
            'end_s': '' if fe == -1 else round(fe / fps, 2),
            'variation': inst.get('variation_id', 0),
            'split': inst.get('split', ''),
        })

ids = sorted({r['youtube_id'] for r in rows})


def check(vid):
    url = f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json'
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            info = json.load(resp)
            return vid, resp.status, info.get('title', ''), info.get('author_name', '')
    except urllib.error.HTTPError as e:
        return vid, e.code, '', ''
    except Exception as e:  # network hiccup
        return vid, f'err:{type(e).__name__}', '', ''


with ThreadPoolExecutor(max_workers=8) as pool:
    status = {vid: (code, title, author) for vid, code, title, author in pool.map(check, ids)}

for r in rows:
    code, title, author = status[r['youtube_id']]
    r['status'], r['title'], r['channel'] = code, title, author

with open(out_path, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

ok_by_label = {}
for r in rows:
    if r['status'] == 200:
        ok_by_label.setdefault(r['label'], []).append(r)
codes = {}
for code, _, _ in status.values():
    codes[code] = codes.get(code, 0) + 1
covered = [l for l in labels if l in ok_by_label]
missing = [l for l in labels if l not in ok_by_label]
print(f'YouTube instances: {len(rows)}, unique videos: {len(ids)}, status counts: {codes}')
print(f'labels with >=1 working YouTube video: {len(covered)}/{len(labels)}')
print('labels with none:', ', '.join(missing) or '-')
counts = sorted(len(v) for v in ok_by_label.values())
if counts:
    print(f'working videos per covered label: min {counts[0]}, median {counts[len(counts)//2]}, max {counts[-1]}')
channels = {}
for r in rows:
    if r['status'] == 200:
        channels[r['channel']] = channels.get(r['channel'], 0) + 1
print('top channels:', sorted(channels.items(), key=lambda kv: -kv[1])[:8])
