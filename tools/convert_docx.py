"""Convert an end-of-system revision .docx into the site's three Markdown files.

    python tools/convert_docx.py <file.docx> content/<system-folder> "<System name>"

The document must have three parts (headings starting "PART 1", "PART 2", "PART 3"):
  front matter + Part 1 Rapid Revision Note  → rapid-revision.md
  Part 2 System Trap Note                    → traps.md
  Part 3 Volatile Facts Deck                 → fact-deck.md (checklists / sources go to rapid-revision.md)

Works with both layouts seen so far: Word "Heading 1/2" + table-based traps, and the
custom DeckTitle / PartHeading / H1x / H2x styles with bullet-based traps.
"""
import re, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
src, outdir, sysname = sys.argv[1], sys.argv[2], sys.argv[3]
z = zipfile.ZipFile(src)
root = ET.fromstring(z.read('word/document.xml'))
names = {}
for s in ET.fromstring(z.read('word/styles.xml')).iter(W + 'style'):
    n = s.find(W + 'name')
    names[s.get(W + 'styleId')] = (n.get(W + 'val') if n is not None else '').lower()

TOP = {'heading 1', 'decktitle', 'title', 'covertitle'}            # → "#"
SEC = {'heading 2', 'h1x'}                           # → "##"
SUB3 = {'heading 3', 'h2x'}                          # → "###" (trap titles in Part 2)
SUBT = {'subtitle', 'decksubtitle', 'coversub'}


def ptext(p):
    out = []
    for el in p.iter():
        if el.tag == W + 't': out.append(el.text or '')
        elif el.tag == W + 'tab': out.append(' ')
        elif el.tag in (W + 'br', W + 'cr'): out.append('\n')
    return re.sub(r'[ \t]+', ' ', ''.join(out)).strip()


def pstyle(p):
    ps = p.find(W + 'pPr/' + W + 'pStyle')
    return names.get(ps.get(W + 'val'), '') if ps is not None else ''


items = []  # ('p', style, text) | ('tbl', rows)   rows = [[ [para, …] cell ]]
for el in root.find(W + 'body'):
    if el.tag == W + 'p':
        t = ptext(el)
        if t: items.append(('p', pstyle(el), t))
    elif el.tag == W + 'tbl':
        rows = [[[t for t in (ptext(p) for p in tc.iter(W + 'p')) if t] for tc in tr.findall(W + 'tc')] for tr in el.findall(W + 'tr')]
        rows = [r for r in rows if any(r)]
        if rows: items.append(('tbl', rows))

cell = lambda c: ' '.join(c).replace('|', '/').strip()
unbullet = lambda t: re.sub(r'^[•·▪]\s*', '', t).strip()
is_bullet = lambda t: t[:1] in '•·▪☐□'
cap = lambda t: t[:1].upper() + t[1:]
tidy = lambda lines: re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip() + '\n'
trace = lambda t: re.sub(r'^(Trace-?back|TRACE\s*/\s*SOURCE)\s*:\s*', 'Source: ', t, flags=re.I)
is_trace = lambda t: bool(re.match(r'^(Trace-?back|TRACE\s*/\s*SOURCE|Source)\s*:', t, re.I))


def split_steps(text):
    parts = re.split(r'(?:^|(?<=[^\d\s]))\s*(\d{1,2})\.\s+', text)
    return [(parts[i], parts[i + 1].strip()) for i in range(1, len(parts) - 1, 2)]


def md_bullet(t):
    t = unbullet(t)
    if t[:1] in '☐□': return '- [ ] ' + t[1:].strip()
    if re.match(r'^\d+\.\s', t): return t
    return '- ' + trace(t)


def box(title, paras):
    out = [f'> **{title}**']
    for b in paras:
        b = unbullet(b)
        steps = split_steps(b) if re.match(r'^1\.\s', b) else []
        if len(steps) >= 2: out += [f'> {n}. {s}' for n, s in steps]
        elif re.match(r'^\d+\.\s', b): out.append(f'> {b}')
        elif ' • ' in b: out += [f'> - {s.strip()}' for s in b.split(' • ') if s.strip()]
        elif is_trace(b): out.append(f'> {trace(b)}')
        else: out.append(f'> - {b}' if len(paras) > 1 else f'> {b}')
    return '\n'.join(out)


def md_table(rows):
    rows = [[cell(c) for c in r] for r in rows]
    n = max(len(r) for r in rows)
    rows = [r + [''] * (n - len(r)) for r in rows]
    return '\n'.join(['| ' + ' | '.join(rows[0]) + ' |', '|' + '---|' * n] + ['| ' + ' | '.join(r) + ' |' for r in rows[1:]])


def emit_notes(seq, out):
    """Generic Word → notes Markdown (headings, bullets, tables, one-column tables as boxes)."""
    last_top = False
    for it in seq:
        if it[0] == 'p':
            st, t = it[1], it[2]
            if st in TOP: out += ['', f'# {t}']; last_top = True; continue
            if st in SUBT and last_top: out.append(t); continue
            last_top = False
            if st in SEC: out += ['', f'## {t}', '']
            elif st in SUB3: out += ['', f'### {t}', '']
            elif is_bullet(t): out.append(md_bullet(t))
            elif st not in SUBT and len(t) > 3: out.append(t)
        else:
            last_top = False
            rows = it[1]
            if all(len(r) == 1 for r in rows):
                paras = [p for r in rows for p in r[0]]
                out += ['', box(paras[0], paras[1:]), '']
            else:
                out += ['', md_table(rows), '']


# ---------------------------------------------------------------- split parts
part, buckets = 'front', {'front': [], 'p1': [], 'p2': [], 'p3': [], 'refs': []}
for it in items:
    if it[0] == 'p':
        t = it[2]
        m = re.match(r'^PART\s*([123])\b', t)
        if m: part = 'p' + m.group(1); continue
        if it[1] in TOP and t.lower().startswith('reference'): part = 'refs'
    buckets[part].append(it)

# old layout: cover page lines without a style are decoration
front = [it for it in buckets['front'] if not (it[0] == 'p' and it[1] == '' and not is_bullet(it[2]))]

# Part 3 sections
p3_sections, cur = [], None
for it in buckets['p3']:
    if it[0] == 'p' and it[1] in SEC:
        cur = {'title': re.sub(r'^([A-Z]|\d+)\.\s*', '', it[2]).strip(), 'items': []}
        p3_sections.append(cur)
    elif cur:
        cur['items'].append(it)
NOTES_ONLY = re.compile(r'checklist|source|reference|maintenance|ledger|register|\bQA\b|control', re.I)
PRIORITY = re.compile(r'\b(RED|AMBER)\b')

# ---------------------------------------------------------------- traps.md
LABEL = {'tempting wrong choice': 'Tempting', 'decisive discriminator': 'Decisive clue', 'what to do in the exam': 'In the exam', 'trace-back': 'Source'}
tr = [f'<!-- {sysname} · Part 2 System Trap Note -->', '', f'# {sysname} — System Trap Note', '']


def field(label, value):
    label = label.strip().rstrip(':')
    return f'- {LABEL.get(label.lower(), label)}: {value.strip()}'


for it in buckets['p2']:
    if it[0] == 'p':
        st, t = it[1], it[2]
        if st in SUB3 | SEC or re.match(r'^Trap\s*\d+', t): tr += ['', f'## {t}']
        elif is_bullet(t) and ':' in t:
            label, _, value = unbullet(t).partition(':')
            tr.append(field(label, value))
        elif not any(l.startswith('## ') for l in tr):         # intro text before the first trap
            tr += ['', '> **ABOUT THIS TRAP NOTE**', f'> {t}', '']
        continue
    rows = it[1]
    if all(len(r) == 1 for r in rows):
        paras = [p for r in rows for p in r[0]]
        if re.match(r'^Trap\s*\d+', paras[0]):               # one-cell trap: "Label: value" lines
            tr += ['', f'## {paras[0]}']
            for v in paras[1:]:
                if is_trace(v): tr.append('- ' + trace(v)); continue
                label, sep, value = unbullet(v).partition(':')
                if sep: tr.append(field(label, value))
        else:                                                 # intro box
            tr += ['', box(paras[0], paras[1:]), '']
        continue
    tr += ['', f'## {rows[0][0][0]}']                         # old table-based trap
    for r in rows[1:]:
        for v in (r[1] if len(r) > 1 else []):
            m = re.match(r'Trace-back:\s*(.+)', v)
            tr.append(f'- Source: {m.group(1)}' if m else field(cell(r[0]), v))
open(f'{outdir}/traps.md', 'w', encoding='utf8').write(tidy(tr))

# ---------------------------------------------------------------- fact-deck.md
COLLABEL = [(r'trap', 'Trap: '), (r'clue|discriminat', 'Decisive clue: '), (r'trace|source', 'Source: '),
            (r'first-line|initial', 'First-line: '), (r'definitive|escalation', 'Definitive / next escalation: ')]
collabel = lambda h: next((lab for re_, lab in COLLABEL if re.search(re_, h, re.I)), '')

fd = [f'<!-- {sysname} · Part 3 Volatile Facts Deck -->', '']
leftovers = []  # Part 3 lines that do not make a clean card → appended to rapid-revision.md


def priority_cards(sec):
    out = []
    for it in sec['items']:
        if it[0] != 'tbl' or not all(len(r) == 1 for r in it[1]): continue
        paras = [p for r in it[1] for p in r[0]]
        level = 'red' if re.search(r'\bRED\b', paras[0]) else 'amber'
        src_line = next((trace(p) for p in paras if p.startswith('Trace-back')), '')
        for p in paras[1:]:
            t = unbullet(p).rstrip('.')
            if t.startswith('Trace-back') or ' — ' in t: continue
            if ' = ' in t: q, a = t.split(' = ', 1); q, a = q.strip() + ' = ?', a.strip()
            elif ': ' in t: q, a = t.split(': ', 1); q, a = q.strip() + '?', cap(a.strip())
            else: continue
            out += [f'## {q}', f'- {a}', f'- Priority: {level}'] + ([f'- {src_line}'] if src_line else []) + ['']
    return out


prio = [s for s in p3_sections if PRIORITY.search(s['title']) and not NOTES_ONLY.search(s['title'])]
if prio:
    fd += ['# Personal Priority (RED / AMBER)', '']
    for s in prio: fd += priority_cards(s)

for sec in p3_sections:
    title = sec['title']
    if NOTES_ONLY.search(title) or PRIORITY.search(title): continue
    low = title.lower()
    fd += ['', f'# {title}', '']
    for it in sec['items']:
        if it[0] == 'p':
            t = it[2]
            if not is_bullet(t): continue
            body = unbullet(t)
            m = re.search(r'\s*\[([^\]]+)\]\s*$', body)          # trailing "[D13 > Growth]" trace tag
            src_line = [f'- Source: {m.group(1)}'] if m else []
            body = body[:m.start()] if m else body
            head, sep, rest = body.partition(':')
            pattern = re.search(r'image|pattern|data', low)
            if pattern and '→' in body:                          # "clue → answer" becomes a recall question
                lead = head.strip() + ': ' if sep and len(head) <= 30 else ''
                segs = [x.strip() for x in (rest if lead else body).rstrip('.').split(';')]
                segs = segs if all('→' in x for x in segs) else [(rest if lead else body).rstrip('.')]
                for seg in segs:
                    q, _, a = seg.rpartition('→')
                    fd += [f'## {lead}{q.strip()} → ?', f'- {cap(a.strip())}'] + src_line + ['']
            elif sep and len(head) <= 60:
                suffix = ' — timing' if 'timing' in low else ' — imaging clue' if pattern else ''
                fd += [f'## {head.strip()}{suffix}', f'- {cap(rest.strip())}'] + src_line + ['']
            else:
                leftovers.append(md_bullet(t))
            continue
        rows = it[1]
        if all(len(r) == 1 for r in rows):
            paras = [p for r in rows for p in r[0]]
            steps = [re.sub(r'^\d+\.\s*', '', unbullet(x)) for x in paras[1:] if re.match(r'^\d+\.\s', unbullet(x))]
            if len(steps) >= 3:                                   # algorithm box → sequence card
                name = re.sub(r'^(QUICK\s+)?ALGORITHM\s*[A-Z0-9]*\s*[—–-]\s*', '', paras[0], flags=re.I)
                fd.append(f'## {name} — sequence')
                fd += [f'{i}. {x}' for i, x in enumerate(steps, 1)]
                fd += ['- ' + trace(x) for x in paras[1:] if is_trace(x)] + ['']
            continue                                              # other boxes (e.g. "USE") are intros
        hdr = [cell(c) for c in rows[0]]
        for r in rows[1:]:
            c = [cell(x) for x in r] + [''] * (len(hdr) - len(r))
            if not c[0]: continue
            if 'formula' in low:
                name = re.split(r'\s[=≈]\s', c[0])[0].strip()
                fd += [f'## {name} — formula?', f'- {c[0]}']
                if len(hdr) >= 3 and re.search(r'substitut|worked', hdr[1], re.I):   # worked example columns
                    fd += [f'- Worked example: {c[1]} → {c[2]}', '']
                    continue
            elif 'sequence' in low and '→' in c[1]:
                fd.append(f'## {c[0]} — sequence')
                fd += [f'{i}. {x.strip()}' for i, x in enumerate(c[1].split('→'), 1)]
                c = c[:1] + [''] + c[2:]
            elif any(re.search(r'first-line|initial', h, re.I) for h in hdr[1:]):
                fd.append(f'## {c[0]}: first-line vs next step')
            else:
                fd.append(f'## {c[0]}')
            for h, v in zip(hdr[1:], c[1:]):
                if v: fd.append(f'- {collabel(h)}{v}')
            fd.append('')
open(f'{outdir}/fact-deck.md', 'w', encoding='utf8').write(tidy(fd))

# ---------------------------------------------------------------- rapid-revision.md
rr = [f'<!-- {sysname} · Part 1 Complete Rapid Revision Note -->']
emit_notes(front, rr)
if not any(l.startswith('# ') for l in rr): rr.insert(1, f'# {sysname}')
rr += ['', '# Complete Rapid Revision Note']
emit_notes(buckets['p1'], rr)
for sec in p3_sections:
    if NOTES_ONLY.search(sec['title']) or PRIORITY.search(sec['title']):
        rr += ['', f'## {sec["title"]}', '']
        emit_notes(sec['items'], rr)
if leftovers:
    rr += ['', '## Volatile Facts Deck — other one-liners', ''] + leftovers
emit_notes(buckets['refs'], rr)
open(f'{outdir}/rapid-revision.md', 'w', encoding='utf8').write(tidy(rr))

print('ok')
