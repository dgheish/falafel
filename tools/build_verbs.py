#!/usr/bin/env python3
"""Build content/verbs.json from tools/verbs_src.txt.

"Right now" is 3am + the present form. "Future" is ra7 + the present form
without its b-/mn- prefix (bekteb -> ra7 ekteb, btekteb -> ra7 tekteb).
Run tools/bump.sh afterwards.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'verbs_src.txt'
OUT = ROOT / 'content' / 'verbs.json'

PERSONS = [
    {'key': 'ana', 'latin': 'ana', 'arabic': 'أنا', 'english': 'I', 'en': 'I'},
    {'key': 'enta', 'latin': 'enta', 'arabic': 'إنت', 'english': 'you (to a man)', 'en': 'you'},
    {'key': 'ente', 'latin': 'ente', 'arabic': 'إنتِ', 'english': 'you (to a woman)', 'en': 'you'},
    {'key': 'huwwe', 'latin': 'huwwe', 'arabic': 'هوّي', 'english': 'he', 'en': 'he'},
    {'key': 'hiyye', 'latin': 'hiyye', 'arabic': 'هيّي', 'english': 'she', 'en': 'she'},
    {'key': 'ne7na', 'latin': 'ne7na', 'arabic': 'نحنا', 'english': 'we', 'en': 'we'},
    {'key': 'ento', 'latin': 'ento', 'arabic': 'إنتو', 'english': 'you (all)', 'en': 'you'},
    {'key': 'hinne', 'latin': 'hinne', 'arabic': 'هنّي', 'english': 'they', 'en': 'they'},
]
COMMAND_TO = [
    {'key': 'enta', 'english': 'to a man'},
    {'key': 'ente', 'english': 'to a woman'},
    {'key': 'ento', 'english': 'to a group'},
]
TENSES = [
    {'key': 'past', 'label': 'Past', 'hint': 'What already happened: yesterday, last year.'},
    {'key': 'present', 'label': 'Every day', 'hint': 'Habits and facts. The verb starts with b- (mn- for "we").'},
    {'key': 'now', 'label': 'Right now', 'hint': 'Happening at this moment: put 3am before the every-day form.'},
    {'key': 'future', 'label': 'Future', 'hint': 'What will happen: ra7, then the every-day form without its b-.'},
    {'key': 'command', 'label': 'Commands', 'hint': 'Telling someone to do it.'},
]
BE = {'I': "I'm", 'you': "you're", 'he': "he's", 'she': "she's", 'we': "we're", 'they': "they're"}
VOWELS = 'aeiou'


def pair(text):
    if '=' not in text:
        raise ValueError(f'expected "latin = arabic", got: {text!r}')
    latin, arabic = (x.strip() for x in text.split('=', 1))
    return latin, arabic


def future(latin, arabic, person):
    """bekteb/بكتب -> ra7 ekteb/رح اكتب, btekteb/بتكتب -> ra7 tekteb/رح تكتب."""
    if latin.startswith('mn'):
        l, a = latin[1:], arabic[1:]           # mnekteb -> nekteb, منكتب -> نكتب
    elif latin.startswith(('bt', 'by')):
        l, a = latin[1:], arabic[1:]           # btekteb -> tekteb, بتكتب -> تكتب
    else:
        l, a = latin[1:], arabic[1:]           # bekteb -> ekteb, بكتب -> كتب
        if l[:1] in VOWELS and not a.startswith(('ا', 'أ', 'إ')):
            a = 'ا' + a                         # كتب -> اكتب
    return 'ra7 ' + l, 'رح ' + a


def main():
    verbs, cur = [], None
    for n, raw in enumerate(SRC.read_text(encoding='utf-8').splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        try:
            if line.startswith('@'):
                vid, icon, base, past, ing, s = (x.strip() for x in line[1:].split('|'))
                cur = {'id': vid, 'icon': icon, 'en': {'base': base, 'past': past, 'ing': ing, 's': s}, 'raw': {}, 'override': {}}
                verbs.append(cur)
            elif line.startswith('future-'):
                who, rest = line[len('future-'):].split(':', 1)
                cur['override'][who.strip()] = pair(rest)
            else:
                kind, rest = line.split(':', 1)
                cur['raw'][kind.strip()] = [pair(x) for x in rest.split(';')]
        except Exception as e:  # noqa: BLE001
            sys.exit(f'verbs_src.txt line {n}: {e}')

    out_verbs = []
    for v in verbs:
        r, en = v['raw'], v['en']
        if len(r.get('past', [])) != 8 or len(r.get('present', [])) != 8 or len(r.get('command', [])) != 3:
            sys.exit(f'{v["id"]}: needs 8 past, 8 present and 3 command forms')
        forms = {t['key']: [] for t in TENSES}
        for i, p in enumerate(PERSONS):
            who = p['en']
            third = who in ('he', 'she')
            pl, pa = r['past'][i]
            forms['past'].append({'person': p['key'], 'latin': pl, 'arabic': pa, 'english': f'{who} {en["past"]}'})
            sl, sa = r['present'][i]
            forms['present'].append({'person': p['key'], 'latin': sl, 'arabic': sa, 'english': f'{who} {en["s"] if third else en["base"]}'})
            forms['now'].append({'person': p['key'], 'latin': '3am ' + sl, 'arabic': 'عم ' + sa, 'english': f'{BE[who]} {en["ing"]}'})
            fl, fa = v['override'].get(p['key']) or future(sl, sa, p['key'])
            forms['future'].append({'person': p['key'], 'latin': fl, 'arabic': fa, 'english': f"{who}'ll {en['base']}"})
        for i, c in enumerate(COMMAND_TO):
            cl, ca = r['command'][i]
            forms['command'].append({'person': c['key'], 'latin': cl + '!', 'arabic': ca + '!', 'english': f'{en["base"].capitalize()}! ({c["english"]})'})
        for t, rows in forms.items():
            for row in rows:
                row['id'] = f'verb-{v["id"]}-{t}-{row["person"]}'
        out_verbs.append({'id': v['id'], 'icon': v['icon'], 'english': 'to ' + en['base'], 'forms': forms})

    data = {
        '_note': 'DRAFT. Built from tools/verbs_src.txt by tools/build_verbs.py; edit the source, not this file.',
        'persons': [{k: p[k] for k in ('key', 'latin', 'arabic', 'english')} for p in PERSONS],
        'commandTo': COMMAND_TO,
        'tenses': TENSES,
        'verbs': out_verbs,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    clips = sum(len(rows) for v in out_verbs for rows in v['forms'].values())
    print(f'{len(out_verbs)} verbs, {clips} clips -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
