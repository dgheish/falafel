"""Check content/lessons.json before publishing.

Usage (from the repository root):  python3 tools/check_content.py

Fails on: Arabizi with non-Latin characters (look-alike Cyrillic letters, ç, ü, %),
duplicate clip ids, unknown dialogue speakers, quiz answers out of range,
and lessons too short for the quiz. Prints totals when everything passes.
"""
import json, re, sys

ALLOWED = re.compile(r"^[A-Za-z0-9 .,!?'\-éè…():/]*$")

d = json.load(open('content/lessons.json'))
errors, ids = [], []
for lv in d['levels']:
    for l in lv['lessons']:
        if l.get('soon'):
            continue
        if len(l['items']) < 4:
            errors.append(f"{l['id']}: needs at least 4 phrases for the quiz")
        for x in l['items'] + l['dialogue']:
            ids.append(x['id'])
            forms = [x['arabizi']] + ([x['f']['arabizi']] if 'f' in x else [])
            for a in forms:
                if not ALLOWED.match(a):
                    errors.append(f"{x['id']}: odd character in arabizi: {a!r}")
            if x in l['dialogue'] and x['speaker'] not in d['speakers']:
                errors.append(f"{x['id']}: speaker {x['speaker']!r} missing from 'speakers'")
        for q in l.get('questions', []):
            if not 0 <= q['answer'] < len(q['options']):
                errors.append(f"{l['id']}: question answer out of range: {q['q']}")
seen = set()
for i in ids:
    if i in seen:
        errors.append(f'duplicate clip id: {i}')
    seen.add(i)

# Verb tables (built from tools/verbs_src.txt)
verb_clips = 0
try:
    vd = json.load(open('content/verbs.json'))
    for v in vd['verbs']:
        for rows in v['forms'].values():
            for r in rows:
                verb_clips += 1
                if r['id'] in seen:
                    errors.append(f"duplicate clip id: {r['id']}")
                seen.add(r['id'])
                if not ALLOWED.match(r['latin']):
                    errors.append(f"{r['id']}: odd character in latin: {r['latin']!r}")
except FileNotFoundError:
    pass

# Grammar and culture pages (built from tools/grammar_src.txt). French words like "ça va" are fine here.
GRAMMAR_OK = re.compile(r"^[A-Za-z0-9 .,!?'\-éèçà…():/]*$")
grammar_clips = 0
try:
    gd = json.load(open('content/grammar.json'))
    for t in gd['topics']:
        for sec in t['sections']:
            for b in sec['blocks']:
                if b['type'] != 'ex':
                    continue
                grammar_clips += 1
                if b['id'] in seen:
                    errors.append(f"duplicate clip id: {b['id']}")
                seen.add(b['id'])
                if not GRAMMAR_OK.match(b['arabizi']):
                    errors.append(f"{b['id']}: odd character in arabizi: {b['arabizi']!r}")
        for q in t['quiz']:
            if not 0 <= q['answer'] < len(q['options']):
                errors.append(f"{t['id']}: question answer out of range: {q['q']}")
except FileNotFoundError:
    pass

if errors:
    print('\n'.join(errors))
    sys.exit(1)
lessons = [l for lv in d['levels'] for l in lv['lessons'] if not l.get('soon')]
fem = sum(1 for l in lessons for i in l['items'] if 'f' in i)
print(f'OK: {len(lessons)} lessons, {len(ids) + fem} lesson clips + {verb_clips} verb clips + {grammar_clips} grammar clips to record')
