/* Volatile Facts Deck — content parser (no dependencies).
 * Content lives in Markdown files under content/<system>/:
 *   fact-deck.md       "# Section" → "## Question" → "- answer lines"
 *   traps.md           "## Trap N — title" → "- Tempting: …", "- Correct rule: …", …
 *   rapid-revision.md  notes: # / ## headings, - bullets, | tables |, > **BOX** callouts
 * Exposes window.FactParser: TYPES, parseDeck(text), parseNotes(text), buildCard, parseLine
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
    [/FIRST-?LINE/i, 'firstline'],
    [/DISTRACTOR|DECISIVE CLUE|DISCRIMINAT|\sVS\.?\s/i, 'distractor'],
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

  /* ---------------- Markdown readers ---------------- */
  const isComment = l => /^\s*<!--.*-->\s*$/.test(l);

  // fact-deck.md → { sections:[{ title, cards:[{ heading, lines[] }] }] }
  function parseDeck(text) {
    const sections = [];
    let section = null, card = null;
    for (const raw of text.split(/\r?\n/)) {
      const l = raw.trim();
      if (!l || isComment(l)) continue;
      let m;
      if ((m = l.match(/^#\s+(.+)/))) {
        section = { title: m[1].trim(), cards: [] };
        sections.push(section);
        card = null;
      } else if ((m = l.match(/^#{2,4}\s+(.+)/))) {
        if (!section) { section = { title: 'Facts', cards: [] }; sections.push(section); }
        card = { heading: m[1].trim(), lines: [] };
        section.cards.push(card);
      } else if (card) {
        card.lines.push(l.replace(/^[-*+]\s+/, ''));
      }
    }
    return { sections: sections.filter(s => s.cards.length) };
  }

  /* rapid-revision.md → blocks:
   *   { k:'h1'|'sub'|'h2'|'p'|'li', t }
   *   { k:'table', head:[…], rows:[[…]] }        Markdown table (first row = header)
   *   { k:'box', title, lines:[…] }             "> **TITLE**" followed by "> …" lines */
  function parseNotes(text) {
    const blocks = [];
    let table = null, box = null;
    const cells = row => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    for (const raw of text.split(/\r?\n/)) {
      const l = raw.trim();
      if (l.startsWith('|')) {
        box = null;
        if (/^\|[\s:|-]+\|?$/.test(l)) continue; // header separator row
        if (!table) { table = { k: 'table', head: cells(l), rows: [] }; blocks.push(table); }
        else table.rows.push(cells(l));
        continue;
      }
      table = null;
      let m;
      if ((m = l.match(/^>\s?(.*)/))) {
        const t = m[1].trim();
        const title = t.match(/^\*\*(.+)\*\*$/);
        if (!box || (title && box.lines.length)) { box = { k: 'box', title: '', lines: [] }; blocks.push(box); }
        if (title && !box.title && !box.lines.length) box.title = title[1];
        else if (t) box.lines.push(t);
        continue;
      }
      box = null;
      if (!l || isComment(l)) continue;
      const prev = blocks[blocks.length - 1];
      if ((m = l.match(/^#\s+(.+)/))) blocks.push({ k: 'h1', t: m[1] });
      else if ((m = l.match(/^#{2,4}\s+(.+)/))) blocks.push({ k: 'h2', t: m[1] });
      else if ((m = l.match(/^[-*+]\s+(.+)/))) blocks.push({ k: 'li', t: m[1] });
      else if (/^\d+[.)]\s/.test(l)) blocks.push({ k: 'li', t: l });
      else blocks.push({ k: prev && prev.k === 'h1' ? 'sub' : 'p', t: l });
    }
    // a "> **TITLE**" with no lines and no title → drop
    return blocks.filter(b => b.k !== 'box' || b.title || b.lines.length);
  }

  /* traps.md → { intro:[box…], traps:[{ title, fields:[{ label, text }], source }] }
   *   ## Trap 1 — Title
   *   - Tempting: …   - Why it looks right: …   - Decisive clue: …
   *   - Correct rule: …   - Latest protocol: …   - In the exam: …   - Source: … */
  function parseTraps(text) {
    const intro = parseNotes(text.split(/\r?\n(?=##\s)/)[0]).filter(b => b.k === 'box');
    const traps = [];
    let cur = null;
    for (const raw of text.split(/\r?\n/)) {
      const l = raw.trim();
      let m;
      if ((m = l.match(/^#{2,4}\s+(.+)/))) { cur = { title: m[1].trim(), fields: [], source: '' }; traps.push(cur); }
      else if (cur && (m = l.match(/^[-*+]\s+([^:]{2,40}):\s*(.+)/))) {
        if (/^(source|trace-?back)$/i.test(m[1].trim())) cur.source = m[2].trim();
        else cur.fields.push({ label: m[1].trim(), text: m[2].trim() });
      }
    }
    return { intro, traps: traps.filter(t => t.fields.length) };
  }

  window.FactParser = { TYPES, parseDeck, parseNotes, parseTraps, buildCard, parseLine };
})();
