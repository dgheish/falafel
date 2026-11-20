#!/usr/bin/env python3
"""Append new examples to lessons in content/lessons.json.

Input is a plain text file:

    @ <lessonId>
    arabizi | arabic | english | pic | note | f arabizi | f arabic

Only the first four fields are required. New items get ids <lessonId>-NN,
numbered after the highest number already used in that lesson, so existing
clip ids (and recordings) never change. An example whose arabizi is already
in the lesson is skipped and reported.

Usage: python3 tools/add_items.py <file.txt> [--dry-run]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LESSONS = ROOT / 'content' / 'lessons.json'


def parse(path):
    out, current = {}, None
    for n, raw in enumerate(Path(path).read_text(encoding='utf-8').splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('@'):
            current = line[1:].strip()
            out.setdefault(current, [])
            continue
        if current is None:
            sys.exit(f'line {n}: example before any "@ lessonId" line')
        f = [x.strip() for x in line.split('|')]
        if len(f) < 4 or not all(f[:4]):
            sys.exit(f'line {n}: needs at least arabizi | arabic | english | pic')
        item = {'arabizi': f[0], 'arabic': f[1], 'english': f[2], 'pic': f[3]}
        if len(f) > 4 and f[4]:
            item['note'] = f[4]
        if len(f) > 6 and f[5] and f[6]:
            item['f'] = {'arabizi': f[5], 'arabic': f[6]}
        out[current].append(item)
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    dry = '--dry-run' in sys.argv
    adds = parse(sys.argv[1])
    data = json.loads(LESSONS.read_text(encoding='utf-8'))
    lessons = {l['id']: l for lv in data['levels'] for l in lv['lessons']}
    total = 0
    for lid, items in adds.items():
        if lid not in lessons:
            sys.exit(f'unknown lesson id: {lid}')
        lesson = lessons[lid]
        have = {i['arabizi'].lower() for i in lesson['items']}
        used = [int(m.group(1)) for i in lesson['items'] if (m := re.fullmatch(re.escape(lid) + r'-(\d+)', i['id']))]
        nxt = max(used + [len(lesson['items'])]) + 1
        for it in items:
            if it['arabizi'].lower() in have:
                print(f'  skipped (already in {lid}): {it["arabizi"]}')
                continue
            it = {'id': f'{lid}-{nxt:02d}', **it}
            nxt += 1
            have.add(it['arabizi'].lower())
            lesson['items'].append(it)
            total += 1
        print(f'{lid}: now {len(lesson["items"])} examples')
    print(f'added {total} examples' + (' (dry run, nothing saved)' if dry else ''))
    if not dry:
        LESSONS.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
