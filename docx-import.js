/* FactDeck — .docx reader + fact classifier (no dependencies).
 * Exposes window.FactParser:
 *   TYPES                         – fact categories (label, icon)
 *   parseDocx(arrayBuffer)        – Promise<{ sections:[{title, subtitle, cards:[rawCard]}] }>
 *   buildCard(heading, lines, section) – normalised card from a heading + text lines
 */
(function () {
  'use strict';

  const TYPES = {
    dose:           { label: 'Dose',  icon: '💊' },
    threshold:      { label: 'Cutoff',     icon: '📏' },
    timing:         { label: 'Timing',          icon: '⏱️' },
    classification: { label: 'Definition',   icon: '🏷️' },
    immunization:   { label: 'Vaccine rule',      icon: '💉' },
    antidote:       { label: 'Antidote',               icon: '🧪' },
    genetic:        { label: 'Genetics',    icon: '🧬' },
    algorithm:      { label: 'Emergency steps',     icon: '🚨' },
    pattern:        { label: 'Image / ECG clue', icon: '📈' },
    clinical:       { label: 'Clinical clue', icon: '🩺' },
    firstline:      { label: 'First-line',      icon: '🥇' },
    distractor:     { label: 'Distractor',       icon: '⚖️' },
    formula:        { label: 'Formula',                icon: '🧮' },
    error:          { label: 'Missed before',    icon: '📕' },
    checklist:      { label: 'Checklist',              icon: '☑️' },
    fact:           { label: 'Fact',         icon: '📌' },
    guide:          { label: 'Guide',         icon: 'ℹ️' },
  };

  // Heading keywords → type (checked in order; first match wins).
  const HEADING_RULES = [
    [/CHECKLIST/i, 'checklist'],
    [/DISTRACTOR|DECISIVE CLUE|DISCRIMINAT|\bA\s+VS\.?\s+B\b/i, 'distractor'],
    [/ALGORITHM|SEQUENCE|STEPS?\b|MANAGEMENT ORDER/i, 'algorithm'],
    [/FORMULA|EQUATION|CALCULAT/i, 'formula'],
    [/ANTIDOTE/i, 'antidote'],
    [/\bDOSE|DOSING|DOSAGE/i, 'dose'],
    [/THRESHOLD|CUT-?OFF|CUTOFF|LIMIT/i, 'threshold'],
    [/TIMING|WINDOW|WHEN\b/i, 'timing'],
    [/IMMUNI[SZ]|VACCIN|CATCH-?UP/i, 'immunization'],
    [/GENETIC|GENE\b|CHROMOSOM|INHERIT/i, 'genetic'],
    [/\bECG\b|\bEEG\b|IMAGE|X-?RAY|\bCT\b|\bMRI\b|PATTERN/i, 'pattern'],
    [/FIRST-?LINE|TREATMENT OF CHOICE|DRUG OF CHOICE|\bTOC\b|\bDOC\b/i, 'firstline'],
    [/WARNING SIGNS?|RED FLAGS?|\bSIGNS?\b|FEATURES|CLINICAL CLUE/i, 'clinical'],
    [/CLASSIFICATION|STAGING|STAGE|GRADE|CRITERIA|DEFINITION|DEFINED/i, 'classification'],
    [/ERROR|MISSED|REPEAT(ED)? FAIL/i, 'error'],
  ];

  // Body keywords used when the heading alone doesn't tell us.
  const BODY_RULES = [
    [/\s=\s[^\n]*[×÷*\/]/, 'formula'],
    [/antidote|reversal agent|reverse[sd]? with/i, 'antidote'],
    [/\b\d+(\.\d+)?\s*(mg|mcg|µg|g|mL|units?|IU|mEq|mmol)\/kg\b|\bmg\/m2|\bmg\/m²/i, 'dose'],
    [/vaccin|immuni[sz]|catch-?up|\bdose of (BCG|OPV|IPV|DTP|MMR|Hep)/i, 'immunization'],
    [/\b(gene|mutation|deletion|trisomy|autosomal|X-linked|chromosome)\b/i, 'genetic'],
    [/\b(ECG|EEG|X-?ray|CT|MRI|USG|ultrasound)\b|hypsarrhythmia|spike/i, 'pattern'],
    [/first-line|treatment of choice|drug of choice/i, 'firstline'],
    [/\bwithin\s+\d+|\bby day\s+\d+|\b\d+\s*(h|hours|days|weeks)\b/i, 'timing'],
    [/[≥≤<>]\s*\d|threshold|cut-?off/i, 'threshold'],
    [/\s=\s/, 'formula'],
  ];

  const GUIDE_RE = /HOW TO USE|MEMORY RULE|TRACE-?BACK CHAIN|WHY THIS FORMAT|^(RED|AMBER|GREEN)\s*[—–-]/i;
  // Headings that are just a category label ("FORMULA CARD") — the real prompt is the first line.
  const LABEL_RE = /^(?:\d+-MINUTE\s+)?(?:MICRO-?)?(?:FORMULA|DOSE|THRESHOLD|CUT-?OFF|TIMING(?: WINDOW)?|CLASSIFICATION|STAGING|ANTIDOTE|CLOSE DISTRACTOR|DISTRACTOR|PATTERN(?: CLUE)?|IMAGE CLUE|ECG CLUE|EEG CLUE|GENETIC(?:S| ASSOCIATION)?|FIRST-?LINE VS TOC|ERROR NOTEBOOK|IMMUNI[SZ]ATION(?: RULE)?)(?:\s+(?:CARD|FACT))?$/i;

  function inferType(heading, lines) {
    if (GUIDE_RE.test(heading)) return 'guide';
    for (const [re, t] of HEADING_RULES) if (re.test(heading)) return t;
    const body = lines.join('\n');
    if (lines.filter(l => /^\s*(\d+[.)]|step\s*\d)/i.test(l)).length >= 3) return 'algorithm';
    for (const [re, t] of BODY_RULES) if (re.test(body)) return t;
    return 'fact';
  }

  // Classify one body line → {k: kind, t: text}
  function parseLine(raw) {
    let t = raw.replace(/\s+/g, ' ').trim().replace(/^[•·▪◦●■\-–*]\s*/, '');
    let m;
    if (/^☐|^\[ ?\]/.test(t)) return { k: 'check', t: t.replace(/^☐\s*|^\[ ?\]\s*/, '') };
    if ((m = t.match(/^(trap|pitfall|don'?t|avoid)\s*:\s*/i))) return { k: 'trap', t: t.slice(m[0].length) };
    if ((m = t.match(/^(memory cue|cue|mnemonic|remember)\s*:\s*/i))) return { k: 'cue', t: t.slice(m[0].length) };
    if ((m = t.match(/^(decisive clue|clue|key clue|discriminator)\s*:\s*/i))) return { k: 'clue', t: t.slice(m[0].length) };
    if ((m = t.match(/^(tempting|distractor)\s*:\s*/i))) return { k: 'tempting', t: t.slice(m[0].length) };
    if ((m = t.match(/^(\d+)[.)]\s+/))) return { k: 'step', t: t.slice(m[0].length), n: +m[1] };
    return { k: 'text', t };
  }

  function titleCase(s) {
    if (s !== s.toUpperCase()) return s;
    return s.toLowerCase().replace(/(^|[\s(/—–-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
      .replace(/\b(Vs|Of|And|Or|The|To|In|For)\b/g, w => w.toLowerCase())
      .replace(/\b(Abg|Gir|Oi|Nrp|Dka|Ivig|Tof|Ecg|Eeg|Toc|Ct|Mri|Hiv|Tb)\b/g, w => w.toUpperCase());
  }

  /** heading: string; lines: string[]; section: string */
  function buildCard(heading, lines, section) {
    heading = (heading || '').replace(/\s+/g, ' ').trim();
    lines = lines.map(l => l.trim()).filter(Boolean);

    const traces = [];
    const body = [];
    for (const l of lines) {
      if (/^↩|^(trace(-?back)?|source|ref)\s*:/i.test(l)) traces.push(l.replace(/^↩\s*|^(trace(-?back)?|source|ref)\s*:\s*/i, ''));
      else body.push(l);
    }

    const num = (heading.match(/^(\d+)[.)]\s+/) || [])[1];
    const cleanHeading = heading.replace(/^\d+[.)]\s+/, '');
    const type = inferType(cleanHeading, body);

    let title = cleanHeading;
    let parsed = body.map(parseLine);
    const keepsHeading = type === 'checklist' || type === 'algorithm' || /\bVS\b/i.test(cleanHeading) || type === 'guide';
    if (LABEL_RE.test(cleanHeading) && !keepsHeading && parsed.length && parsed[0].k === 'text') {
      title = parsed[0].t;
      parsed = parsed.slice(1);
    }

    return {
      title: titleCase(title),
      label: titleCase(cleanHeading),
      num: num ? +num : undefined,
      type,
      section: section || 'Imported',
      lines: parsed,
      trace: traces.join(' | '),
    };
  }

  /* ---------------- ZIP (central directory) reader ---------------- */
  async function unzip(buf, wanted) {
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a valid .docx (zip) file');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const out = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
      p += 46 + nlen + xlen + clen;
      if (!wanted.includes(name)) continue;
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = new Uint8Array(buf, start, csize);
      if (method === 0) out[name] = dec.decode(data);
      else if (method === 8) {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        out[name] = await new Response(stream).text();
      } else throw new Error('Unsupported zip compression in ' + name);
    }
    return out;
  }

  /* ---------------- WordprocessingML walker ---------------- */
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const kids = (el, name) => Array.from(el.childNodes).filter(c => c.nodeType === 1 && c.localName === name);
  const kid = (el, name) => kids(el, name)[0];

  function paraText(p) {
    let s = '';
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType !== 1) continue;
        const ln = c.localName;
        if (ln === 'del' || ln === 'instrText' || ln === 'delText') continue;
        if (ln === 't') s += c.textContent;
        else if (ln === 'tab') s += ' ';
        else if (ln === 'br' || ln === 'cr') s += '\n';
        else walk(c);
      }
    })(p);
    return s;
  }

  function paraInfo(p, styleNames) {
    const pPr = kid(p, 'pPr');
    const styleId = pPr && kid(pPr, 'pStyle') ? kid(pPr, 'pStyle').getAttributeNS(W, 'val') : '';
    const style = (styleNames[styleId] || styleId || '').toLowerCase();
    const isList = !!(pPr && kid(pPr, 'numPr'));
    const runs = Array.from(p.getElementsByTagNameNS(W, 'r')).filter(r => r.getElementsByTagNameNS(W, 't').length);
    const bold = runs.length > 0 && runs.every(r => {
      const rPr = kid(r, 'rPr');
      const b = rPr && kid(rPr, 'b');
      return b && b.getAttributeNS(W, 'val') !== '0' && b.getAttributeNS(W, 'val') !== 'false';
    });
    return { text: paraText(p), style, isList, bold };
  }

  const isSectionStyle = s => /^(title|decktitle|heading ?1)$/.test(s) || /decktitle|^title/.test(s);
  const isSubStyle = s => /subtitle|decksub/.test(s);
  const isCardHeadStyle = s => /^heading ?[2-4]$/.test(s);
  const isNoise = s => /tiny|footer|header|caption/.test(s);

  function cellParas(tc, styleNames) {
    const out = [];
    for (const p of tc.getElementsByTagNameNS(W, 'p')) {
      const info = paraInfo(p, styleNames);
      for (const piece of info.text.split('\n')) if (piece.trim()) out.push({ ...info, text: piece.trim() });
    }
    return out;
  }

  async function parseDocx(arrayBuffer) {
    const files = await unzip(arrayBuffer, ['word/document.xml', 'word/styles.xml']);
    if (!files['word/document.xml']) throw new Error('word/document.xml not found — is this a Word file?');
    const xml = new DOMParser().parseFromString(files['word/document.xml'], 'application/xml');

    const styleNames = {};
    if (files['word/styles.xml']) {
      const sx = new DOMParser().parseFromString(files['word/styles.xml'], 'application/xml');
      for (const st of sx.getElementsByTagNameNS(W, 'style')) {
        const nm = kid(st, 'name');
        styleNames[st.getAttributeNS(W, 'styleId')] = nm ? nm.getAttributeNS(W, 'val') : '';
      }
    }

    const body = xml.getElementsByTagNameNS(W, 'body')[0];
    const sections = [];
    let section = null;
    let openCard = null; // for non-table docs: heading paragraph followed by bullet paragraphs

    const ensureSection = () => {
      if (!section) { section = { title: 'Imported facts', subtitle: '', cards: [] }; sections.push(section); }
      return section;
    };
    const closeCard = () => { if (openCard && openCard.lines.length) ensureSection().cards.push(openCard); openCard = null; };

    for (const el of Array.from(body.childNodes)) {
      if (el.nodeType !== 1) continue;

      if (el.localName === 'p') {
        const info = paraInfo(el, styleNames);
        const text = info.text.replace(/\s+/g, ' ').trim();
        if (!text || isNoise(info.style)) continue;
        if (isSectionStyle(info.style)) {
          closeCard();
          section = { title: text, subtitle: '', cards: [] };
          sections.push(section);
        } else if (isSubStyle(info.style) && section && !section.cards.length && !section.subtitle) {
          section.subtitle = text;
        } else if (isCardHeadStyle(info.style) || (info.bold && !info.isList && text.length < 90 && !/^[•☐↩]/.test(text))) {
          closeCard();
          openCard = { heading: text, lines: [] };
        } else if (openCard) {
          openCard.lines.push(text);
        } else if (/^[•·\-–]/.test(text) || info.isList) {
          openCard = { heading: text.replace(/^[•·\-–]\s*/, ''), lines: [] };
        }
        continue;
      }

      if (el.localName === 'tbl') {
        closeCard();
        const rows = kids(el, 'tr').map(tr => kids(tr, 'tc').map(tc => cellParas(tc, styleNames)));
        const nonEmpty = rows.map(r => r.filter(c => c.length)).filter(r => r.length);
        if (!nonEmpty.length) continue;

        // Q | A grid: several rows, multiple columns, cells mostly one paragraph.
        const multiCol = nonEmpty.filter(r => r.length >= 2).length;
        const simpleCells = nonEmpty.flat().every(c => c.length <= 3);
        const boxStyle = nonEmpty.flat().some(c => c.length > 1 && /^[•☐↩]/.test(c[1].text));
        if (nonEmpty.length >= 2 && multiCol >= nonEmpty.length - 1 && simpleCells && !boxStyle) {
          let header = null;
          const first = nonEmpty[0];
          if (first.every(c => c.length === 1 && c[0].text.split(' ').length <= 4 && (c[0].bold || /question|trigger|fact|answer|prompt|cue|topic|source|trace/i.test(c[0].text)))) {
            header = first.map(c => c[0].text.toLowerCase());
            nonEmpty.shift();
          }
          for (const r of nonEmpty) {
            const heading = r[0].map(x => x.text).join(' ');
            const lines = [];
            r.slice(1).forEach((c, i) => {
              const h = header && header[i + 1];
              c.forEach(x => lines.push(h && /trace|source|ref/.test(h) ? '↩ ' + x.text : x.text));
            });
            if (heading) ensureSection().cards.push({ heading, lines });
          }
          continue;
        }

        // Boxed cards: every non-empty cell is one card (heading = first paragraph).
        for (const r of nonEmpty) for (const c of r) {
          ensureSection().cards.push({ heading: c[0].text, lines: c.slice(1).map(x => x.text) });
        }
      }
    }
    closeCard();
    return { sections: sections.filter(s => s.cards.length) };
  }

  window.FactParser = { TYPES, parseDocx, buildCard, parseLine };
})();
