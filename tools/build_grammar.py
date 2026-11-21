#!/usr/bin/env python3
"""Build content/grammar.json (Grammar and Culture pages) from tools/grammar_src.txt.

See the top of grammar_src.txt for the format. Run tools/bump.sh afterwards.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'grammar_src.txt'
OUT = ROOT / 'content' / 'grammar.json'

GROUPS = [
    {'key': 'start', 'title': 'Start here', 'section': 'grammar'},
    {'key': 'basics', 'title': 'The basics', 'section': 'grammar'},
    {'key': 'sentences', 'title': 'Building sentences', 'section': 'grammar'},
    {'key': 'verbs', 'title': 'Verbs', 'section': 'grammar'},
    {'key': 'culture', 'title': 'Culture and real life', 'section': 'culture'},
]


def main():
    topics, topic, sec, table = [], None, None, None
    for n, raw in enumerate(SRC.read_text(encoding='utf-8').splitlines(), 1):
        line = raw.strip()
        if not line.startswith('|'):
            table = None
        if not line or line.startswith('#') and not line.startswith('##'):
            continue
        try:
            if line.startswith('@@'):
                tid, icon, group, title = (x.strip() for x in line[2:].split('|'))
                if group not in {g['key'] for g in GROUPS}:
                    raise ValueError(f'unknown group {group!r}')
                topic = {'id': tid, 'icon': icon, 'group': group, 'title': title, 'summary': '',
                         'sections': [], 'mistakes': [], 'quiz': [], '_n': 0}
                topics.append(topic)
                sec = None
                continue
            if topic is None:
                raise ValueError('text before the first @@ topic')
            if line.startswith('>'):
                topic['summary'] = line[1:].strip()
            elif line.startswith('##'):
                sec = {'h': line[2:].strip(), 'blocks': []}
                topic['sections'].append(sec)
            elif line.startswith('!:'):
                topic['mistakes'].append(line[2:].strip())
            elif line.startswith('?:'):
                q, *opts = (x.strip() for x in line[2:].split('|'))
                right = [i for i, o in enumerate(opts) if o.startswith('*')]
                if len(right) != 1 or len(opts) < 2:
                    raise ValueError('a question needs 2+ options and exactly one *right one')
                topic['quiz'].append({'q': q, 'options': [o.lstrip('*').strip() for o in opts], 'answer': right[0]})
            else:
                if sec is None:
                    sec = {'h': '', 'blocks': []}
                    topic['sections'].append(sec)
                if line.startswith('|'):
                    cells = [c.strip() for c in line[1:].split('|')]
                    if table is None:
                        table = {'type': 'table', 'head': cells, 'rows': []}
                        sec['blocks'].append(table)
                    else:
                        table['rows'].append(cells)
                elif line.startswith('ex:'):
                    f = [x.strip() for x in line[3:].split('|')]
                    if len(f) < 3 or not all(f[:3]):
                        raise ValueError('an example needs latin | arabic | english')
                    topic['_n'] += 1
                    ex = {'type': 'ex', 'id': f'gr-{topic["id"]}-{topic["_n"]:02d}',
                          'arabizi': f[0], 'arabic': f[1], 'english': f[2]}
                    if len(f) > 3 and f[3]:
                        ex['note'] = f[3]
                    sec['blocks'].append(ex)
                elif line.startswith('tip:'):
                    sec['blocks'].append({'type': 'tip', 'text': line[4:].strip()})
                else:
                    sec['blocks'].append({'type': 'p', 'text': line})
        except Exception as e:  # noqa: BLE001
            sys.exit(f'grammar_src.txt line {n}: {e}')

    ids = [t['id'] for t in topics]
    if len(ids) != len(set(ids)):
        sys.exit('two topics have the same id')
    for t in topics:
        del t['_n']
    data = {'_note': 'DRAFT. Built from tools/grammar_src.txt by tools/build_grammar.py; edit the source, not this file.',
            'groups': GROUPS, 'topics': topics}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    exs = sum(1 for t in topics for s in t['sections'] for b in s['blocks'] if b['type'] == 'ex')
    qs = sum(len(t['quiz']) for t in topics)
    print(f'{len(topics)} topics, {exs} examples to record, {qs} practice questions -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
