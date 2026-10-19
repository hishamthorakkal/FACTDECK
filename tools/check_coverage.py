"""Check that every line of text in a source .docx made it onto the site.

    python tools/check_coverage.py <file.docx> content/<system-folder>

Prints the fragments it cannot find in the system's Markdown files. Table headers whose rows
became cards, and the PART headings that became tabs, are expected to show up here.
"""
import glob, re, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
docx, folder = sys.argv[1], sys.argv[2]
root = ET.fromstring(zipfile.ZipFile(docx).read('word/document.xml'))

# the site shortens these trap-field labels
RENAMES = [('tempting wrong choice', 'tempting'), ('decisive discriminator', 'decisive clue'), ('what to do in the exam', 'in the exam')]


def norm(t):
    t = t.replace('|', '/')
    t = re.sub(r'^([A-Z]|\d+)\.\s+(?=[A-Z])', '', t.strip())        # section letters "A. " / "1. "
    for a, b in RENAMES: t = re.sub(a, b, t, flags=re.I)
    t = re.sub(r'^[•·▪☐□]\s*', '', t.strip())
    t = re.sub(r'^(Trace-?back|TRACE\s*/\s*SOURCE)\s*:\s*', '', t, flags=re.I)
    return re.sub(r'[\s*>#\-–—:→.;,()\[\]"“”\'’]+', ' ', t).lower().strip()


paras = []
for p in root.iter(W + 'p'):
    t = re.sub(r'\s+', ' ', ''.join((e.text or '') if e.tag == W + 't' else ' ' if e.tag == W + 'tab' else '' for e in p.iter())).strip()
    if len(t) >= 4: paras.append(t)

site = norm(' '.join(open(f, encoding='utf8').read() for f in glob.glob(folder + '/*.md')))
missing = []
for t in paras:
    if norm(t) in site: continue
    # paragraphs split into steps, bullets or question → answer cards: check each piece
    pieces = [norm(x) for x in re.split(r'\s(?=\d{1,2}\.\s)|(?<=\.)(?=\d{1,2}\.\s)| • |; |\s*→\s*|: |\[|\]|QUICK ALGORITHM —|ALGORITHM [A-Z0-9]+ —', t) if len(norm(x)) > 3]
    if pieces and all(x in site for x in pieces): continue
    missing.append(t)

print(f'{len(paras)} text fragments checked, {len(missing)} not found on the site')
for m in missing: print('  MISSING:', m[:160])
