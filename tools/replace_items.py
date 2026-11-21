#!/usr/bin/env python3
"""Replace ALL the examples of some lessons in content/lessons.json.

Same input format as add_items.py:

    @ <lessonId>
    arabizi | arabic | english | pic | note

The lesson's examples become exactly these, numbered <lessonId>-01, -02, ...
Only use this for lessons with NO recordings yet: a recording belongs to a clip id,
so after a replace the old recording would play over the new text.
The script refuses a lesson if audio/ already has a file for one of its examples.

Usage: python3 tools/replace_items.py <file.txt> [--dry-run]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from add_items import parse  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
LESSONS = ROOT / 'content' / 'lessons.json'
AUDIO = ROOT / 'audio'


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    dry = '--dry-run' in sys.argv
    new = parse(sys.argv[1])
    data = json.loads(LESSONS.read_text(encoding='utf-8'))
    lessons = {l['id']: l for lv in data['levels'] for l in lv['lessons']}
    recorded = {p.stem.removesuffix('-f') for p in AUDIO.glob('*.*')} if AUDIO.exists() else set()
    for lid, items in new.items():
        if lid not in lessons:
            sys.exit(f'unknown lesson id: {lid}')
        old = lessons[lid]['items']
        if any(i['id'] in recorded for i in old):
            sys.exit(f'{lid} already has recordings in audio/: add examples with add_items.py instead')
        lessons[lid]['items'] = [{'id': f'{lid}-{n:02d}', **it} for n, it in enumerate(items, 1)]
        print(f'{lid}: {len(old)} examples -> {len(items)}')
    if not dry:
        LESSONS.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
