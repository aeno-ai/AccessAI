"""Pick one ASL clip per word (plus up to 3 spares) from the checked WLASL
YouTube list, and check the FSL candidate videos. Writes two CSVs.
Usage: python -I wlasl_pick.py <WLASL_v0.3.json> <checked.csv from wlasl_youtube_check.py> <labels.json> <learn/asl-youtube.csv> <learn/fsl-youtube-candidates.csv>
"""
import collections
import csv
import json
import sys
import urllib.error
import urllib.request

wlasl_path, checked_csv, labels_path, asl_out, fsl_out = sys.argv[1:6]
data = json.load(open(wlasl_path, encoding='utf-8'))
labels = list(json.load(open(labels_path, encoding='utf-8')).values())

# The way of signing each word that WLASL has the most examples of.
main_var = {}
for g in data:
    c = collections.Counter(i.get('variation_id', 0) for i in g['instances'])
    main_var[g['gloss']] = c.most_common(1)[0][0]

CHANNEL_RANK = {'Signs': 0, 'VALENCIA ASL': 1, 'Scott Spethman': 2}
rows = [r for r in csv.DictReader(open(checked_csv, encoding='utf-8')) if r['status'] == '200']
by_label = collections.defaultdict(list)
for r in rows:
    by_label[r['label']].append(r)


def score(r):
    whole = r['start_s'] in ('0', '0.0') and r['end_s'] == ''
    exact = r['title'].strip().lower().strip("'\"") == r['label']
    return (
        int(r['variation']) != main_var[r['label']],  # main way of signing first
        'not-recommended' in r['title'].lower(),      # the uploader's own warning
        not whole,                                     # a video that is only this sign
        CHANNEL_RANK.get(r['channel'], 9),
        not exact,
    )


def clip(r):
    return r['youtube_id'] + (f"@{r['start_s']}-{r['end_s']}" if r['end_s'] else '')


with open(asl_out, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['label', 'youtube_id', 'start_s', 'end_s', 'channel', 'title', 'main_variant', 'spares'])
    seen_ids = set()
    for label in labels:
        cands, uniq = sorted(by_label[label], key=score), []
        for r in cands:
            if clip(r) not in seen_ids and clip(r) not in [clip(u) for u in uniq]:
                uniq.append(r)
        best = uniq[0]
        w.writerow([label, best['youtube_id'], best['start_s'], best['end_s'], best['channel'], best['title'],
                    'y' if int(best['variation']) == main_var[label] else 'n',
                    ' '.join(clip(r) for r in uniq[1:4])])

# FSL: topic lessons found by web search on 2026-10-12. Each shows several
# signs, so a teammate who knows FSL must watch and note start/end seconds.
FSL = [
    ('Greetings', 'DQ3GIGE3Kyc'), ('Greetings', 'Y1IfQ4DuQxU'), ('Greetings', 'iom4x_bn2MI'),
    ('Greetings', 'GMuVRoGYhjs'), ('Greetings', 'UytbjabYX_8'), ('Colours', 'Q5XkJbmpazo'),
    ('Colours', 'duIpuveWMJU'), ('Numbers', 'LGd_2OnXMnI'), ('Days and time', 'WLdZ2P_JRsM'),
    ('Family and people', 'Bx6N6wmrNDI'), ('Food and drink', '0YrfM-tp6dk'), ('Mixed basics', 'BuGUnvUSAZg'),
    ('Mixed basics', 'Eq4sedxNUOs'), ('Mixed basics', '4-NoYErrA54'), ('About FSL', 'leTo5-lzex4'),
]


def oembed(vid):
    url = f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json'
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            info = json.load(resp)
            return 200, info.get('title', ''), info.get('author_name', '')
    except urllib.error.HTTPError as e:
        return e.code, '', ''


with open(fsl_out, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['unit', 'youtube_id', 'status', 'channel', 'title'])
    for unit, vid in FSL:
        code, title, author = oembed(vid)
        w.writerow([unit, vid, code, author, title])
        print(unit, vid, code, '|', author, '|', title[:70])

main = sum(1 for r in csv.DictReader(open(asl_out, encoding='utf-8')) if r['main_variant'] == 'y')
whole = sum(1 for r in csv.DictReader(open(asl_out, encoding='utf-8')) if not r['end_s'])
print(f'ASL picks: {len(labels)} words, {main} show the main way of signing, {whole} are single-sign videos')
