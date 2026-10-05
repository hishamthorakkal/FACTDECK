"""Convert an end-of-system revision .docx (Part 1 Rapid Revision, Part 2 Trap Note,
Part 3 Volatile Facts Deck) into the site's Markdown files:
    python tools/convert_docx.py <file.docx> content/<system-folder> "<System name>"
"""
import re, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
src, outdir, sysname = sys.argv[1], sys.argv[2], sys.argv[3]
z = zipfile.ZipFile(src)
root = ET.fromstring(z.read('word/document.xml'))
sroot = ET.fromstring(z.read('word/styles.xml'))
names = {}
for s in sroot.iter(W + 'style'):
    n = s.find(W + 'name')
    names[s.get(W + 'styleId')] = n.get(W + 'val') if n is not None else ''


def ptext(p):
    out = []
    for el in p.iter():
        if el.tag == W + 't':
            out.append(el.text or '')
        elif el.tag == W + 'tab':
            out.append(' ')
        elif el.tag in (W + 'br', W + 'cr'):
            out.append('\n')
    return re.sub(r'[ \t]+', ' ', ''.join(out)).strip()


def pstyle(p):
    ps = p.find(W + 'pPr/' + W + 'pStyle')
    return names.get(ps.get(W + 'val'), '').lower() if ps is not None else ''


items = []
for el in root.find(W + 'body'):
    if el.tag == W + 'p':
        t = ptext(el)
        if t:
            items.append(('p', pstyle(el), t))
    elif el.tag == W + 'tbl':
        rows = []
        for tr in el.findall(W + 'tr'):
            rows.append([[t for t in (ptext(p) for p in tc.iter(W + 'p')) if t] for tc in tr.findall(W + 'tc')])
        items.append(('tbl', [r for r in rows if any(r)]))


def cell(c):
    return ' '.join(c).replace('|', '/').strip()


def split_steps(text):
    """'1. Foo.2. Bar.' -> [('1','Foo.'), ('2','Bar.')]"""
    parts = re.split(r'(?:^|(?<=[^\d\s]))\s*(\d{1,2})\.\s+', text)
    return [(parts[i], parts[i + 1].strip()) for i in range(1, len(parts) - 1, 2)]


def box(title, paras):
    out = [f'> **{title}**']
    for b in paras:
        steps = split_steps(b) if re.match(r'^1\.\s', b) else []
        if len(steps) >= 2:
            out += [f'> {n}. {s}' for n, s in steps]
        elif ' • ' in b:
            out += [f'> - {s.strip()}' for s in b.split(' • ') if s.strip()]
        else:
            out.append(f'> {b}')
    return '\n'.join(out)


def md_table(rows):
    rows = [[cell(c) for c in r] for r in rows]
    n = max(len(r) for r in rows)
    rows = [r + [''] * (n - len(r)) for r in rows]
    lines = ['| ' + ' | '.join(rows[0]) + ' |', '|' + '---|' * n]
    return '\n'.join(lines + ['| ' + ' | '.join(r) + ' |' for r in rows[1:]])


def bullet(t):
    t = re.sub(r'^[•·]\s*', '', t)
    return '- [ ] ' + t[1:].strip() if t.startswith('□') else '- ' + t


def tidy(lines):
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip() + '\n'


# ---- split into parts
part, buckets = 'front', {'front': [], 'p1': [], 'p2': [], 'p3': [], 'refs': []}
for it in items:
    if it[0] == 'p' and it[1] == 'heading 1':
        t = it[2]
        if t.startswith('PART 1'): part = 'p1'; continue
        if t.startswith('PART 2'): part = 'p2'; continue
        if t.startswith('PART 3'): part = 'p3'; continue
        if t.startswith('Reference'): part = 'refs'
    buckets[part].append(it)


def emit_notes(seq, out):
    for it in seq:
        if it[0] == 'p':
            st, t = it[1], it[2]
            if st == 'heading 1': out += ['', f'# {t}', '']
            elif st == 'heading 2': out += ['', f'## {t}', '']
            elif t[0] in '•□': out.append(bullet(t))
        else:
            rows = it[1]
            if not rows: continue
            if all(len(r) == 1 for r in rows):  # one-column table = callout box
                paras = [p for r in rows for p in r[0]]
                out += ['', box(paras[0], paras[1:]), '']
            else:
                out += ['', md_table(rows), '']


# ---- rapid-revision.md: cover boxes + how-to + roadmap + Part 1 + final checklist + references
rr = [f'<!-- {sysname} · Part 1 Complete Rapid Revision Note -->', '',
      f'# {sysname} — Complete Rapid Revision Note']
cover = [it for it in buckets['front'] if it[0] == 'p' and it[1] == '']
sub = next((it[2] for it in cover if 'NEET' in it[2]), '')
if sub: rr.append(f'{sub}')
emit_notes([it for it in buckets['front'] if not (it[0] == 'p' and it[1] == '' and it[2][0] not in '•□')], rr)
emit_notes(buckets['p1'], rr)
p3 = buckets['p3']
ck = next((i for i, it in enumerate(p3) if it[0] == 'p' and 'Checklist' in it[2] and it[1] == 'heading 2'), len(p3))
# the RED / AMBER / GREEN maintenance table is a study plan, so it goes with the notes
mt = next((i for i, it in enumerate(p3) if it[0] == 'p' and 'AMBER' in it[2] and it[1] == 'heading 2'), None)
if mt is not None:
    rr += ['', '## ' + re.sub(r'^\d+\.\s*', '', p3[mt][2]), '']
    emit_notes([it for it in p3[mt + 1:ck] if it[0] == 'tbl'], rr)
if ck < len(p3):
    rr += ['', '## ' + re.sub(r'^\d+\.\s*', '', p3[ck][2]), '']
    rr += [bullet(it[2]) for it in p3[ck + 1:] if it[0] == 'p']
emit_notes(buckets['refs'], rr)
open(f'{outdir}/rapid-revision.md', 'w', encoding='utf8').write(tidy(rr))

# ---- traps.md: Part 2
LABEL = {'Tempting wrong choice': 'Tempting', 'Decisive discriminator': 'Decisive clue', 'What to do in the exam': 'In the exam'}
tr = [f'<!-- {sysname} · Part 2 System Trap Note -->', '', f'# {sysname} — System Trap Note', '']
for it in buckets['p2']:
    if it[0] != 'tbl': continue
    rows = it[1]
    if all(len(r) == 1 for r in rows):  # "How to use" box
        paras = [p for r in rows for p in r[0]]
        tr += [box(paras[0], paras[1:]), '']
        continue
    tr.append(f'## {rows[0][0][0]}')
    for r in rows[1:]:
        label = cell(r[0]).rstrip(':')
        for v in (r[1] if len(r) > 1 else []):
            m = re.match(r'Trace-back:\s*(.+)', v)
            tr.append(f'- Source: {m.group(1)}' if m else f'- {LABEL.get(label, label)}: {v}')
    tr.append('')
open(f'{outdir}/traps.md', 'w', encoding='utf8').write(tidy(tr))

# ---- fact-deck.md: Part 3 card sections (before the checklist)
fd = [f'<!-- {sysname} · Part 3 Volatile Facts Deck -->', '']
if sysname == 'Neonatology':  # personalised AMBER item (cover page + Trap 1) leads the deck
    fd += ['# Personal Priority (AMBER)', '', '## Jensen BPD grade at 36 wk PMA — what is Grade 3?',
           '- Grade 3 = invasive mechanical ventilation', '- Trap: CPAP/NIPPV at 36 wk PMA is Grade 2, not Grade 3',
           '- Decisive clue: Jensen grading is based on the type of support at 36 wk PMA', '- Source: Day 5 > BPD > Error Notebook 1× AMBER', '']
section = ''
for it in p3[:mt if mt is not None else ck]:
    if it[0] == 'p':
        t = it[2]
        if it[1] == 'heading 2':
            section = re.sub(r'^\d+\.\s*', '', t)
            fd += ['', f'# {section}', '']
        elif t[0] in '•·':  # "Label: clue" bullets (image / pattern clues)
            head, _, rest = re.sub(r'^[•·]\s*', '', t).partition(':')
            fd += [f'## {head.strip()}', f'- {rest.strip()}', ''] if rest else [f'## {head.strip()}', '- (see notes)', '']
        continue
    rows = it[1]
    if len(rows[0]) == 1: continue  # "USE" box
    hdr = [cell(c).lower() for c in rows[0]]
    for r in rows[1:]:
        c = [cell(x) for x in r]
        s = section.lower()
        if 'must-know' in s:
            fd += [f'## {c[0]}', f'- {c[1]}', f'- Trap: {c[2]}', f'- Source: {c[3]}', '']
        elif 'sequence' in s or 'timing' in s:
            fd.append(f'## {c[0]} — sequence')
            fd += [f'{i}. {x.strip()}' for i, x in enumerate(c[1].split('→'), 1)] + ['']
        elif 'first-line' in s:
            fd += [f'## {c[0]}: first-line vs next step', f'- First-line: {c[1]}', f'- Definitive / next escalation: {c[2]}', '']
        elif 'distractor' in s:
            fd += [f'## {c[0]}', f'- Decisive clue: {c[1]}', '']
open(f'{outdir}/fact-deck.md', 'w', encoding='utf8').write(tidy(fd))
print('ok')
