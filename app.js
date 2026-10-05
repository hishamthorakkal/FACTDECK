/* Volatile Facts Deck — systems → Fact Deck / Traps / Rapid Revision.
 * Content is read from content/<system>/fact-deck.md and rapid-revision.md.
 * Only review progress is stored in the browser (localStorage). */
(function () {
  'use strict';

  const { TYPES, parseDeck, parseNotes, parseTraps, buildCard, parseLine } = window.FactParser;
  const SYSTEMS = window.FACTDECK_SYSTEMS;
  const SYS = Object.fromEntries(SYSTEMS.map(s => [s.id, s]));
  const PROGRESS_KEY = 'factdeck.progress.v1';
  const DAY = 864e5;
  const RETIRE_AFTER = 4; // correct in a row → mastered (leaves the review pile)

  // Internal status → simple wording shown to the user
  const STATUS = {
    red:     { word: 'Forgot',       group: 'forgot' },
    amber:   { word: 'Learning',     group: 'learning' },
    green:   { word: 'Almost there', group: 'learning' },
    retired: { word: 'Mastered',     group: 'mastered' },
  };
  const ACTIVE = ['red', 'amber', 'green'];

  const $ = s => document.querySelector(s);
  const now = () => Date.now();
  const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ------------------------------------------------------------ data */
  let cards = [];   // built from the fact-deck files
  const notes = {}; // systemId → rapid-revision blocks
  const trapNotes = {}; // systemId → { intro, traps } from traps.md
  let progress = (() => { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (_) { return {}; } })();
  const saveProgress = () => localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));

  // A fact keeps its progress across deck updates as long as its system + title stay the same.
  const factKey = (sys, title) => sys + '|' + title.toLowerCase().replace(/\s+/g, ' ').trim();

  async function fetchText(path) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      return res.ok ? await res.text() : '';
    } catch (_) { return ''; }
  }

  async function loadContent() {
    await Promise.all(SYSTEMS.map(async s => {
      const [deck, rr, tn] = await Promise.all([
        fetchText(`content/${s.id}/fact-deck.md`),
        fetchText(`content/${s.id}/rapid-revision.md`),
        fetchText(`content/${s.id}/traps.md`),
      ]);
      const seen = new Set();
      for (const sec of parseDeck(deck).sections) for (const rc of sec.cards) {
        const c = buildCard(rc.heading, rc.lines, sec.title);
        const id = factKey(s.id, c.title);
        if (c.type === 'guide' || !c.lines.length || seen.has(id)) continue;
        seen.add(id);
        cards.push({ ...c, id, system: s.id, status: 'amber', streak: 0, misses: 0, due: 0, ...progress[id] });
      }
      const blocks = parseNotes(rr);
      if (blocks.length) notes[s.id] = blocks;
      const t = parseTraps(tn);
      if (t.traps.length) trapNotes[s.id] = t;
    }));
    const order = Object.fromEntries(SYSTEMS.map((s, i) => [s.id, i]));
    cards.sort((a, b) => order[a.system] - order[b.system]); // stable: document order within a system
  }

  // Knew it → climb Learning → Almost there → Mastered. Forgot → back to the start.
  function grade(c, ok) {
    if (ok) {
      c.streak++;
      if (c.streak >= RETIRE_AFTER) { c.status = 'retired'; c.due = now() + 30 * DAY; }
      else if (c.streak >= 2) { c.status = 'green'; c.due = now() + (c.streak === 2 ? 3 : 7) * DAY; }
      else { c.status = 'amber'; c.due = now() + DAY; }
    } else {
      c.streak = 0; c.misses++; c.status = 'red'; c.due = now();
    }
    progress[c.id] = { status: c.status, streak: c.streak, misses: c.misses, due: c.due };
    saveProgress();
  }

  const inScope = sys => c => !sys || c.system === sys;
  const dueCards = sys => cards.filter(c => inScope(sys)(c) && ACTIVE.includes(c.status) && c.due <= now());
  const activeCards = sys => cards.filter(c => inScope(sys)(c) && ACTIVE.includes(c.status));
  const countGroup = (list, g) => list.filter(c => STATUS[c.status].group === g).length;

  /* --------------------------------------------------------- rendering */
  const NUM_RE = /(\d+(?:[.,]\d+)?(?:\s?[–-]\s?\d+(?:[.,]\d+)?)?(?:\s?(?:mg PE\/kg|mg\/kg|mcg\/kg|mL\/kg|g\/kg|mg\/m²|mg\/dL|mg\/mL|mL\/h|g\/g|mg|mcg|mL|g|kg|h|hours?|days?|weeks?|min|s|%)(?![A-Za-z]))?)/g;
  // escape, highlight numbers/doses, and honour **bold** from the Markdown
  const fmt = t => esc(t).replace(NUM_RE, '<b class="num">$1</b>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

  const TAG = { trap: '⚠️ Trap', cue: '💡 Tip', clue: '🎯 Key clue', tempting: '🪤 Tempting' };
  function lineHTML(l, tag = 'li') {
    if (TAG[l.k]) return `<${tag} class="ln ${l.k}"><b class="tag">${TAG[l.k]}</b> ${fmt(l.t)}</${tag}>`;
    if (l.k === 'step') return `<${tag} class="ln step"><span class="stepn">${l.n}</span><span>${fmt(l.t)}</span></${tag}>`;
    if (l.k === 'check') return `<${tag} class="ln check"><label><input type="checkbox" /> <span>${fmt(l.t)}</span></label></${tag}>`;
    const formula = /\s=\s/.test(l.t) && /[×÷*\d]/.test(l.t);
    return `<${tag} class="ln ${formula ? 'formula' : 'text'}">${fmt(l.t)}</${tag}>`;
  }
  const linesHTML = lines => '<ul class="lines">' + lines.map(l => lineHTML(l)).join('') + '</ul>';
  const sourceHTML = c => c.trace ? `<p class="source">📍 ${esc(c.trace.replace(/\s*>\s*/g, ' › '))}</p>` : '';
  const typeHTML = c => `<span class="type">${TYPES[c.type].icon} ${esc(TYPES[c.type].label)}</span>`;
  const statusHTML = c => `<span class="status st-${c.status}">${STATUS[c.status].word}</span>`;
  const sysChip = id => `<span class="sys-chip" style="--s:${SYS[id].color}">${SYS[id].icon} ${esc(SYS[id].name)}</span>`;

  function cardHTML(c) {
    return `<article class="card t-${c.type}" data-fact="${esc(c.id)}" tabindex="0">
      <div class="card-top">${typeHTML(c)}${statusHTML(c)}</div>
      <h3>${esc(c.title)}</h3>
      ${linesHTML(c.lines)}
      ${sourceHTML(c)}
    </article>`;
  }

  function countsHTML(list) {
    return `<span class="count c-forgot"><b>${countGroup(list, 'forgot')}</b> Forgot</span>
      <span class="count c-learning"><b>${countGroup(list, 'learning')}</b> Learning</span>
      <span class="count c-mastered"><b>${countGroup(list, 'mastered')}</b> Mastered</span>`;
  }

  const emptyHTML = (icon, title, text) =>
    `<div class="tab-empty"><span>${icon}</span><h3>${title}</h3><p class="muted">${text}</p></div>`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ------------------------------------------------------------ router */
  let current = null; // system id being viewed, or null for home
  let tab = 'deck';   // deck | traps | rapid | games
  let filter = 'all';
  let query = '';

  function route() {
    const m = location.hash.match(/^#s\/([\w-]+)(?:\/(traps|rapid|games))?/);
    const next = m && SYS[m[1]] ? m[1] : null;
    if (next !== current) { filter = 'all'; query = ''; $('#search').value = ''; }
    current = next;
    tab = (m && m[2]) || 'deck';
    if (session) { session = null; $('#study').hidden = true; }
    if (game) { if (game.timer) clearInterval(game.timer); game = null; $('#study').hidden = true; }
    $('#home').hidden = !!current;
    $('#system').hidden = !current;
    if (current) renderSystem(); else renderHome();
    renderPlayerChip();
    window.scrollTo(0, 0);
  }
  const refresh = () => (current ? renderSystem() : renderHome());

  /* -------------------------------------------------------------- home */
  function renderHome() {
    const due = dueCards().length;
    document.title = 'Volatile Facts Deck · NEET SS Paediatrics';
    $('#dueText').textContent = due ? `${plural(due, 'fact')} to review today` : cards.length ? 'All done for today 🎉' : 'Welcome!';
    $('#dueSub').textContent = cards.length
      ? 'Review everything that is due, or open one system below.'
      : 'Fact decks will appear here as each system is added.';
    $('#startAllBtn').textContent = due ? '▶ Review all due' : '↻ Practise all systems';
    $('#startAllBtn').hidden = !activeCards().length;
    $('#counts').innerHTML = cards.length ? countsHTML(cards) : '';
    renderPlayerChip();

    $('#systems').innerHTML = SYSTEMS.map(s => {
      const list = cards.filter(c => c.system === s.id);
      const d = dueCards(s.id).length;
      const pct = list.length ? Math.round((countGroup(list, 'mastered') / list.length) * 100) : 0;
      const meta = [];
      if (list.length) meta.push(plural(list.length, 'fact') + (d ? ` · <em>${d} due</em>` : ' · ✓ up to date'));
      if (notes[s.id]) meta.push('⚡ Rapid Revision');
      return `<a class="sys" href="#s/${s.id}" style="--s:${s.color}">
        <span class="sys-ico">${s.icon}</span>
        <span class="sys-body">
          <b class="sys-name">${esc(s.name)}</b>
          <span class="sys-meta">${meta.length ? meta.join(' · ') : '<i>Coming soon</i>'}</span>
          ${list.length ? `<span class="sys-bar" title="${pct}% mastered"><span style="width:${pct}%"></span></span>` : ''}
        </span>
        <span class="sys-go">›</span>
      </a>`;
    }).join('');
  }

  /* ------------------------------------------------------------ system */
  function renderSystem() {
    const s = SYS[current];
    const list = cards.filter(c => c.system === current);
    const due = dueCards(current).length;
    document.title = `${s.name} · Volatile Facts Deck`;

    $('#sysHero').style.setProperty('--s', s.color);
    $('#sysHero').innerHTML = `
      <div class="sh-top">
        <span class="sh-ico">${s.icon}</span>
        <div>
          <h1>${esc(s.name)}</h1>
          <p>${list.length ? (due ? `<b>${plural(due, 'fact')}</b> to review today` : 'All done for today 🎉') : 'Fact deck coming soon'}</p>
        </div>
      </div>
      ${list.length ? `<div class="sh-actions">
          <button class="btn start" data-a="study-sys" ${activeCards(current).length ? '' : 'disabled'}>${due ? '▶ Start Review' : '↻ Practise again'}</button>
        </div>
        <div class="counts">${countsHTML(list)}</div>` : ''}`;

    const tabs = [
      ['deck', '🃏 Fact Deck', list.length],
      ['traps', '⚠️ Traps', trapNotes[current] ? trapNotes[current].traps.length : trapItems(list).length],
      ['rapid', '⚡ Rapid Revision', ''],
      ['games', '🎮 Games', ''],
    ];
    $('#sysTabs').style.setProperty('--s', s.color);
    $('#sysTabs').innerHTML = tabs.map(([id, label, n]) =>
      `<a href="#s/${current}${id === 'deck' ? '' : '/' + id}" class="${tab === id ? 'on' : ''}">${label}${n ? ` <small>${n}</small>` : ''}</a>`).join('');

    $('.facts').hidden = tab !== 'deck' || !list.length;
    $('#tabContent').hidden = tab === 'deck' && !!list.length;
    if (tab === 'traps') return renderTraps(list);
    if (tab === 'rapid') return renderRapid();
    if (tab === 'games') return renderGamesTab();
    if (!list.length) {
      $('#tabContent').innerHTML = emptyHTML('🃏', 'Fact deck coming soon', `The ${esc(s.name)} fact deck will appear here once it is added.`);
      return;
    }

    document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('on', b.dataset.f === filter));
    const q = query.toLowerCase();
    const shown = list.filter(c =>
      (filter === 'all' || STATUS[c.status].group === filter) &&
      (!q || (c.title + ' ' + c.section + ' ' + c.lines.map(l => l.t).join(' ')).toLowerCase().includes(q)));
    const sections = [...new Set(shown.map(c => c.section))];
    $('#list').innerHTML = sections.map(sec => `
      <h4 class="section">${esc(sec)}</h4>
      <div class="grid">${shown.filter(c => c.section === sec).map(cardHTML).join('')}</div>`).join('')
      || '<p class="empty">No facts here.</p>';
  }

  /* ------------------------------------------------------------- traps */
  // Every fact that carries a Trap or a Tempting option, with its decisive clue alongside.
  function trapItems(list) {
    return list
      .map(c => ({
        c,
        traps: c.lines.filter(l => l.k === 'trap'),
        tempting: c.lines.filter(l => l.k === 'tempting'),
        clues: c.lines.filter(l => l.k === 'clue'),
      }))
      .filter(x => x.traps.length || x.tempting.length);
  }

  // Trap-note field label → style + icon. Fields after "Why it looks right" stay hidden until revealed.
  const TRAP_FIELD = [
    [/^tempting/i, 'f-tempt', '🪤', false],
    [/^why/i, 'f-why', '🤔', false],
    [/decisive|clue|discriminator/i, 'f-clue', '🎯', true],
    [/correct|rule/i, 'f-rule', '✅', true],
    [/protocol|guideline/i, 'f-proto', '📘', true],
    [/exam/i, 'f-exam', '📝', true],
  ];
  const trapField = label => TRAP_FIELD.find(([re]) => re.test(label)) || [null, 'f-other', '•', true];

  function renderTrapNote(tn) {
    const name = esc(SYS[current].name);
    $('#tabContent').innerHTML = `
      <div class="tab-intro rr-head">
        <div>
          <h2>⚠️ ${plural(tn.traps.length, 'trap')} · ${name}</h2>
          <p class="muted">Read the tempting wrong choice, say the decisive clue out loud, then tap <b>Show the rule</b>.</p>
        </div>
        <div class="row">
          <button class="btn small" data-a="traps-all">👀 Show all rules</button>
          <button class="btn small ghost" data-a="print">🖨️ Print</button>
        </div>
      </div>
      <input type="search" id="trapSearch" placeholder="🔍  Search traps…" />
      <div class="tn-list">${tn.traps.map(t => {
        const [head, ...rest] = t.title.split(/\s+[—–-]\s+/);
        const fields = t.fields.map(f => ({ f, st: trapField(f.label) }));
        const row = ({ f, st: [, cls, ico] }) => `<p class="tn-f ${cls}"><span class="tn-l">${ico} ${esc(f.label)}</span> ${fmt(cap(f.text))}</p>`;
        return `<article class="tn-card">
          <div class="tn-head"><span class="tn-num">${esc(rest.length ? head : 'Trap')}</span><h3>${esc(rest.length ? rest.join(' — ') : head)}</h3></div>
          ${fields.filter(x => !x.st[3]).map(row).join('')}
          <div class="tn-hidden">${fields.filter(x => x.st[3]).map(row).join('')}${t.source ? `<p class="source">📍 ${esc(t.source.replace(/\s*>\s*/g, ' › '))}</p>` : ''}</div>
          <button class="tn-reveal" data-a="trap-toggle">👀 Show the rule</button>
        </article>`;
      }).join('')}</div>`;
  }

  function renderTraps(list) {
    if (trapNotes[current]) return renderTrapNote(trapNotes[current]);
    const items = trapItems(list);
    const name = esc(SYS[current].name);
    if (!items.length) {
      $('#tabContent').innerHTML = list.length
        ? emptyHTML('⚠️', `No traps in ${name} yet`, 'Lines in the fact deck that start with <b>Trap:</b> or <b>Tempting:</b> are collected here automatically.')
        : emptyHTML('⚠️', 'Traps coming soon', `Traps are collected from the ${name} fact deck once it is added.`);
      return;
    }
    const sections = [...new Set(items.map(x => x.c.section))];
    $('#tabContent').innerHTML = `
      <div class="tab-intro">
        <h2>⚠️ ${plural(items.length, 'trap')} in ${name}</h2>
        <p class="muted">The mistakes examiners want you to make. Read these just before the exam. Tap one to open its fact.</p>
      </div>
      ${sections.map(sec => `<h4 class="section">${esc(sec)}</h4>
        <div class="traps">${items.filter(x => x.c.section === sec).map(x => `
          <article class="trap-item" data-fact="${esc(x.c.id)}">
            <div class="trap-q"><span class="dot-st st-${x.c.status}"></span>${esc(x.c.title)}</div>
            ${x.traps.map(l => `<p class="trap-line">⚠️ ${fmt(cap(l.t))}</p>`).join('')}
            ${x.tempting.map(l => `<p class="tempt-line">🪤 <span>Tempting:</span> ${fmt(cap(l.t))}</p>`).join('')}
            ${x.clues.map(l => `<p class="clue-line">🎯 <span>Key clue:</span> ${fmt(cap(l.t))}</p>`).join('')}
          </article>`).join('')}
        </div>`).join('')}`;
  }

  /* ---------------------------------------------------- rapid revision */
  function renderRapid() {
    const name = esc(SYS[current].name);
    const blocks = notes[current];
    if (!blocks) {
      $('#tabContent').innerHTML = emptyHTML('⚡', 'Rapid Revision notes coming soon', `The ${name} rapid revision notes will appear here once they are added.`);
      return;
    }
    $('#tabContent').innerHTML = `
      <div class="tab-intro rr-head">
        <h2>⚡ Rapid Revision · ${name}</h2>
        <button class="btn small ghost" data-a="print">🖨️ Print</button>
      </div>
      ${notesHTML(blocks)}`;
  }

  // Notes are coloured the same way as fact cards (Trap / Cue / Clue lines, numbers, steps).
  const noteLine = raw => /^(source|ref)\s*:/i.test(raw)
    ? `<p class="source">📍 ${esc(raw.replace(/^(source|ref)\s*:\s*/i, '').replace(/\s*>\s*/g, ' › '))}</p>`
    : lineHTML(parseLine(raw), 'p').replace(/^<p class="ln text"/, /^[-*+]\s/.test(raw) ? '<p class="ln text bul"' : '$&');

  // Callout colour from its title: TRAP red, LATEST PROTOCOL blue, ALGORITHM purple, …
  const boxKind = title => {
    const t = title.toUpperCase();
    if (/TRAP|DISCLAIMER|EMERGENCY|DANGER/.test(t)) return 'bx-red';
    if (/PERSONAL|AMBER|PRIORITY/.test(t)) return 'bx-amber';
    if (/ALGORITHM|SEQUENCE|BUNDLE/.test(t)) return 'bx-purple';
    if (/PROTOCOL|UPDATE|GUIDELINE|NUANCE|CURRENCY|ESPGHAN|AAP|ILAE/.test(t)) return 'bx-blue';
    if (/MUST-KNOW|PEARL|DOSE|IVIG|SCREEN/.test(t)) return 'bx-teal';
    if (/REFERENCE|RULE|USE/.test(t)) return 'bx-grey';
    return 'bx-green';
  };

  function notesHTML(blocks) {
    const palette = ['#2b8fe0', '#f0627e', '#2fbf85', '#8a5cf6', '#f07f2a', '#12a594'];
    let n = 0;
    const out = blocks.map(b => {
      if (b.k === 'h1') return `<h2 class="n-h1">${fmt(b.t)}</h2>`;
      if (b.k === 'sub') return `<p class="n-sub">${fmt(b.t)}</p>`;
      if (b.k === 'h2') return `<h3 class="n-h2" style="--c:${palette[n++ % palette.length]}">${fmt(b.t)}</h3>`;
      if (b.k === 'li' || b.k === 'p') return `<div class="n-p">${noteLine(b.t)}</div>`;
      if (b.k === 'table') return `<div class="n-tablewrap"><table class="n-tbl">
        <thead><tr>${b.head.map(h => `<th>${fmt(h)}</th>`).join('')}</tr></thead>
        <tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${fmt(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
      if (b.k === 'box') return `<div class="n-box ${boxKind(b.title)}">${b.title ? `<b class="n-box-h">${fmt(b.title)}</b>` : ''}${b.lines.map(noteLine).join('')}</div>`;
      return '';
    }).join('');
    return `<div class="notes">${out}</div>`;
  }

  /* ------------------------------------------------------------- study */
  let session = null;

  function startStudy(sys) {
    let pool = dueCards(sys);
    if (!pool.length) pool = activeCards(sys);
    if (!pool.length) return;
    const rank = { red: 0, amber: 1, green: 2 };
    pool.sort((a, b) => rank[a.status] - rank[b.status] || a.due - b.due);
    session = { sys, queue: pool.map(c => c.id), i: 0, shown: false, knew: 0, forgot: 0, again: new Set() };
    $('#home').hidden = true;
    $('#system').hidden = true;
    $('#study').hidden = false;
    window.scrollTo(0, 0);
    renderStudy();
  }

  function endStudy() {
    session = null;
    $('#study').hidden = true;
    route();
  }

  function renderStudy() {
    const el = $('#study');
    const total = session.queue.length;

    if (session.i >= total) {
      const all = session.knew + session.forgot;
      el.innerHTML = `
        <div class="done">
          <img src="img/logo.webp" alt="" width="140" height="140" />
          <h2>${session.forgot === 0 ? 'Perfect! 🌟' : 'Well done! 👏'}</h2>
          <p>You knew <b>${session.knew}</b> of <b>${all}</b> answers.</p>
          ${session.forgot ? '<p class="muted">The ones you forgot will come back first next time.</p>' : ''}
          <button class="btn start" data-a="home">${session.sys ? `Back to ${esc(SYS[session.sys].name)}` : 'Back to home'}</button>
        </div>`;
      return;
    }

    const c = cards.find(x => x.id === session.queue[session.i]);
    if (!c) { session.i++; return renderStudy(); }
    el.innerHTML = `
      <div class="study-top">
        <button class="btn small ghost" data-a="home">✕ Close</button>
        <div class="bar"><div style="width:${(session.i / total) * 100}%"></div></div>
        <span>${session.i + 1} / ${total}</span>
      </div>
      <article class="card big t-${c.type}" id="studyCard">
        <div class="card-top">${typeHTML(c)}${session.sys ? '' : sysChip(c.system)}</div>
        <h2>${esc(c.title)}</h2>
        ${session.shown
          ? `<div class="answer">${linesHTML(c.lines)}${sourceHTML(c)}</div>`
          : '<button class="show" data-a="show">👀 Show answer</button>'}
      </article>
      ${session.shown ? `
        <div class="grade">
          <button class="forgot" data-a="forgot">😕 I forgot</button>
          <button class="knew" data-a="knew">😊 I knew it</button>
        </div>` : ''}`;
    if (session.shown) swipe($('#studyCard'));
  }

  function answer(ok) {
    const c = cards.find(x => x.id === session.queue[session.i]);
    grade(c, ok);
    player.stats.reviews++;
    award('first');
    if (player.stats.reviews >= 100) award('century');
    addXP(ok ? (c.status === 'retired' ? 30 : 10) : 2);
    checkMasteryBadges();
    if (ok) session.knew++;
    else {
      session.forgot++;
      if (!session.again.has(c.id)) { // ask once more later in this round
        session.again.add(c.id);
        session.queue.splice(Math.min(session.i + 4, session.queue.length), 0, c.id);
      }
    }
    if (ok && c.status === 'retired') toast('🎉 Mastered! Removed from review');
    session.i++;
    session.shown = false;
    renderStudy();
  }

  // Phone: swipe right = knew it, left = forgot
  function swipe(el) {
    let x0 = null, dx = 0;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; dx = 0; el.style.transition = 'none'; }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (x0 === null) return;
      dx = e.touches[0].clientX - x0;
      el.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
    }, { passive: true });
    el.addEventListener('touchend', () => {
      el.style.transition = '';
      if (Math.abs(dx) > 110) answer(dx > 0); else el.style.transform = '';
      x0 = null;
    });
  }

  /* ============================================================ GAME LAYER */
  // XP, levels, daily streak, badges — stored separately from fact progress.
  const PLAYER_KEY = 'factdeck.player.v1';
  const LEVELS = [
    ['Intern', 0, '🩺'], ['Resident', 200, '📋'], ['Senior Resident', 600, '🧑‍⚕️'],
    ['Fellow', 1500, '🎓'], ['Consultant', 3000, '👑'], ['Professor', 6000, '🏆'],
  ];
  const BADGES = [
    ['first', '🌱', 'First Step', 'Review your first fact'],
    ['century', '💯', 'Century', 'Review 100 facts'],
    ['streak3', '🔥', 'On Fire', 'Revise 3 days in a row'],
    ['streak7', '⚡', 'Unstoppable', 'Revise 7 days in a row'],
    ['master10', '🎓', 'Mastermind', 'Master 10 facts'],
    ['trapPerfect', '🪤', 'Trap Proof', 'Score 10/10 in Trap Hunter'],
    ['rush100', '⏱️', 'Number Cruncher', 'Score 100+ in Number Rush'],
    ['seqPro', '🧩', 'Sequence Pro', 'Order 5 algorithms with no mistakes'],
    ['world', '🌍', 'World Cleared', 'Master every fact in one system'],
  ];
  const freshPlayer = () => ({ xp: 0, streak: 0, lastDay: '', badges: {}, bests: {}, stats: { reviews: 0, perfectSeq: 0 } });
  let player = (() => { try { return { ...freshPlayer(), ...JSON.parse(localStorage.getItem(PLAYER_KEY)) }; } catch (_) { return freshPlayer(); } })();
  const savePlayer = () => localStorage.setItem(PLAYER_KEY, JSON.stringify(player));

  const dayStr = d => new Date(d).toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const liveStreak = () => [dayStr(now()), dayStr(now() - DAY)].includes(player.lastDay) ? player.streak : 0;
  function levelOf(xp) {
    let i = 0;
    while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][1]) i++;
    const [name, from, icon] = LEVELS[i];
    const to = LEVELS[i + 1] ? LEVELS[i + 1][1] : null;
    return { i, name, icon, from, to, pct: to ? Math.round(((xp - from) / (to - from)) * 100) : 100 };
  }

  function touchStreak() {
    const today = dayStr(now());
    if (player.lastDay === today) return;
    player.streak = player.lastDay === dayStr(now() - DAY) ? player.streak + 1 : 1;
    player.lastDay = today;
    if (player.streak >= 3) award('streak3');
    if (player.streak >= 7) award('streak7');
  }

  function addXP(n) {
    if (!n) return;
    const before = levelOf(player.xp).i;
    player.xp += n;
    touchStreak();
    savePlayer();
    floatXP(n);
    const lv = levelOf(player.xp);
    if (lv.i > before) celebrate(lv.icon, 'Level up!', `You are now a ${lv.name}`);
    renderPlayerChip();
  }

  function award(id) {
    if (player.badges[id]) return;
    const b = BADGES.find(x => x[0] === id);
    player.badges[id] = now();
    savePlayer();
    celebrate(b[1], 'Badge unlocked!', `${b[2]}: ${b[3]}`);
  }

  // after any grading: progress badges
  function checkMasteryBadges() {
    if (cards.filter(c => c.status === 'retired').length >= 10) award('master10');
    if (SYSTEMS.some(s => { const l = cards.filter(c => c.system === s.id); return l.length && l.every(c => c.status === 'retired'); })) award('world');
  }

  function floatXP(n) {
    const el = document.createElement('div');
    el.className = 'xp-float';
    el.textContent = `+${n} XP`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  const celebrations = [];
  function celebrate(icon, title, text) {
    celebrations.push({ icon, title, text });
    if (celebrations.length === 1) showCelebration();
  }
  function showCelebration() {
    const c = celebrations[0];
    if (!c) return;
    const el = $('#celebrate');
    el.innerHTML = `<div class="cel-box"><div class="cel-ico">${c.icon}</div><b>${esc(c.title)}</b><span>${esc(c.text)}</span></div>`;
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { celebrations.shift(); showCelebration(); }, 300);
    }, 2300);
  }

  function renderPlayerChip() {
    const lv = levelOf(player.xp);
    const st = liveStreak();
    $('#playerChip').innerHTML = `<span>${lv.icon} Lv ${lv.i + 1}</span><span class="pc-streak ${st ? '' : 'off'}">🔥 ${st}</span>`;
    const bar = $('#playerBar');
    if (bar) bar.innerHTML = `
      <button class="pb" data-a="badges">
        <span class="pb-lv">${lv.icon} <b>${esc(lv.name)}</b> · Level ${lv.i + 1}</span>
        <span class="pb-bar"><span style="width:${lv.pct}%"></span></span>
        <span class="pb-meta">${player.xp} XP${lv.to ? ` · ${lv.to - player.xp} to ${esc(LEVELS[lv.i + 1][0])}` : ''} · 🔥 ${plural(st, 'day')} · 🏅 ${Object.keys(player.badges).length}/${BADGES.length}</span>
      </button>`;
  }

  function showBadges() {
    const lv = levelOf(player.xp);
    $('#modalForm').innerHTML = `
      <div class="badges-head">
        <div class="bh-ico">${lv.icon}</div>
        <div><h2>${esc(lv.name)}</h2><p class="muted">Level ${lv.i + 1} · ${player.xp} XP · 🔥 ${plural(liveStreak(), 'day')} streak</p></div>
      </div>
      <div class="pb-bar big"><span style="width:${lv.pct}%"></span></div>
      <p class="muted small">${lv.to ? `${lv.to - player.xp} XP to ${esc(LEVELS[lv.i + 1][0])}` : 'Top level reached!'} · Knew it +10 · Forgot +2 · Mastered +20 · games give XP too</p>
      <div class="badge-grid">${BADGES.map(([id, ico, name, desc]) => `
        <div class="badge ${player.badges[id] ? 'got' : ''}"><span>${ico}</span><b>${esc(name)}</b><small>${esc(desc)}</small></div>`).join('')}
      </div>
      <div class="actions"><span class="spacer"></span><button value="close" class="btn">Close</button></div>`;
    if (!$('#modal').open) $('#modal').showModal();
  }

  /* ------------------------------------------------------------ game content */
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const best = (sys, k) => (player.bests[sys] || {})[k];
  function setBest(sys, k, v) {
    player.bests[sys] = player.bests[sys] || {};
    const isNew = !(player.bests[sys][k] >= v);
    if (isNew) { player.bests[sys][k] = v; savePlayer(); }
    return isNew;
  }

  // Trap Hunter: traps that have both a tempting wrong choice and a correct rule
  const trapRounds = sys => (trapNotes[sys] ? trapNotes[sys].traps : []).map(t => {
    const get = re => (t.fields.find(f => re.test(f.label)) || {}).text;
    return { title: t.title.replace(/^trap\s*\d+\s*[—–-]\s*/i, ''), num: (t.title.match(/^trap\s*(\d+)/i) || [])[1],
      wrong: get(/^tempting/i), right: get(/correct|rule/i), clue: get(/decisive|clue/i), exam: get(/exam/i), why: get(/^why/i) };
  }).filter(r => r.wrong && r.right);

  // Number Rush: facts whose main answer line holds a number
  const rushPool = sys => cards.filter(c => c.system === sys).map(c => {
    const l = c.lines.find(x => (x.k === 'text' || x.k === 'formula') && /\d/.test(x.t));
    return l && l.t.length <= 120 ? { q: c.title, a: l.t } : null;
  }).filter(Boolean);

  // Sequence Builder: fact cards and Rapid Revision boxes with 3+ numbered steps
  function seqPool(sys) {
    const out = [], seen = new Set();
    const add = (title, steps) => {
      const k = title.toLowerCase();
      if (steps.length >= 3 && steps.length <= 8 && !seen.has(k)) { seen.add(k); out.push({ title, steps }); }
    };
    cards.filter(c => c.system === sys).forEach(c => add(c.title, c.lines.filter(l => l.k === 'step').map(l => l.t)));
    (notes[sys] || []).filter(b => b.k === 'box').forEach(b =>
      add(b.title.replace(/^ALGORITHM\s*\d+\s*[—–-]\s*/i, ''), b.lines.map(parseLine).filter(l => l.k === 'step').map(l => l.t)));
    return out;
  }

  function renderGamesTab() {
    const tr = trapRounds(current).length, rush = rushPool(current).length, seq = seqPool(current).length;
    const b = k => best(current, k);
    const tile = (id, cls, ico, name, desc, n, unit, bestTxt, ok) => `
      <button class="game ${cls}" data-a="play-${id}" ${ok ? '' : 'disabled'}>
        <span class="g-ico">${ico}</span>
        <b>${name}</b>
        <span class="g-desc">${desc}</span>
        <span class="g-meta">${ok ? `${plural(n, unit)}${bestTxt ? ` · 🏆 Best ${bestTxt}` : ''}` : 'Coming soon for this system'}</span>
        ${ok ? '<span class="g-play">▶ Play</span>' : ''}
      </button>`;
    $('#tabContent').innerHTML = `
      <div class="tab-intro"><h2>🎮 Games · ${esc(SYS[current].name)}</h2>
        <p class="muted">Quick games built from this system’s traps, numbers and algorithms. Every game earns XP.</p></div>
      <div class="games">
        ${tile('trap', 'g-trap', '🪤', 'Trap Hunter', 'Spot the correct rule hiding next to the tempting wrong choice.', tr, 'trap', b('trap') != null ? `${b('trap')}/10` : '', tr >= 2)}
        ${tile('rush', 'g-rush', '⏱️', 'Number Rush', '60 seconds. Pick the right dose, cutoff or timing. Build a combo!', rush, 'number fact', b('rush') != null ? b('rush') : '', rush >= 4)}
        ${tile('seq', 'g-seq', '🧩', 'Sequence Builder', 'Tap the steps of each algorithm in the right order.', seq, 'algorithm', b('seq') != null ? `${b('seq')}%` : '', seq >= 1)}
      </div>`;
  }

  /* ------------------------------------------------------------ game engine */
  let game = null;

  function openGame(g) {
    game = { sys: current, score: 0, i: 0, ...g };
    $('#home').hidden = true;
    $('#system').hidden = true;
    $('#study').hidden = false;
    window.scrollTo(0, 0);
  }
  function closeGame() {
    if (game && game.timer) clearInterval(game.timer);
    game = null;
    $('#study').hidden = true;
    route();
  }

  const gameTop = (label, right) => `
    <div class="study-top">
      <button class="btn small ghost" data-a="game-quit">✕ Quit</button>
      <div class="bar"><div style="width:${label}%"></div></div>
      <span>${right}</span>
    </div>`;

  function gameOver(icon, title, lines, xp, again) {
    addXP(xp);
    $('#study').innerHTML = `
      <div class="done">
        <div class="go-ico">${icon}</div>
        <h2>${title}</h2>
        ${lines.map(l => `<p>${l}</p>`).join('')}
        <p class="go-xp">+${xp} XP</p>
        <div class="go-actions">
          <button class="btn start" data-a="play-${again}">↻ Play again</button>
          <button class="btn" data-a="game-quit">Back to games</button>
        </div>
      </div>`;
  }

  function renderGame() {
    if (game.kind === 'trap') return renderTrapHunter();
    if (game.kind === 'rush') return renderRush();
    if (game.kind === 'seq') return renderSeq();
  }

  /* ---- Trap Hunter */
  function startTrapHunter() {
    const rounds = shuffle(trapRounds(current)).slice(0, 10)
      .map(r => ({ ...r, opts: shuffle([{ t: r.right, ok: true }, { t: r.wrong, ok: false }]) }));
    openGame({ kind: 'trap', rounds, pick: null });
    renderGame();
  }
  function renderTrapHunter() {
    const g = game, n = g.rounds.length;
    if (g.i >= n) {
      const isBest = setBest(g.sys, 'trap', g.score);
      if (g.score === n && n >= 10) award('trapPerfect');
      return gameOver(g.score === n ? '🏆' : g.score >= n * 0.7 ? '🎯' : '🪤', `${g.score} / ${n} traps avoided`,
        [g.score === n ? 'Perfect — no trap caught you!' : 'The traps you fell for are worth re-reading in the Traps tab.', isBest ? '🏆 New best!' : ''], g.score * 5, 'trap');
    }
    const r = g.rounds[g.i];
    $('#study').innerHTML = `${gameTop((g.i / n) * 100, `⭐ ${g.score} · ${g.i + 1}/${n}`)}
      <article class="game-card gc-trap">
        <span class="gc-tag">🪤 Trap ${esc(r.num || g.i + 1)}</span>
        <h2>${esc(r.title)}</h2>
        <p class="gc-ask">Which one is the <b>correct rule</b>?</p>
        <div class="opts">${r.opts.map((o, i) => {
          const cls = g.pick == null ? '' : o.ok ? 'right' : i === g.pick ? 'wrong' : 'dim';
          return `<button class="opt-btn ${cls}" data-a="trap-pick" data-i="${i}" ${g.pick == null ? '' : 'disabled'}>${fmt(cap(o.t))}</button>`;
        }).join('')}</div>
        ${g.pick == null ? '' : `
          <div class="gc-feedback ${r.opts[g.pick].ok ? 'good' : 'bad'}">
            <b>${r.opts[g.pick].ok ? '✅ Correct! +5 XP' : '🪤 That’s the trap!'}</b>
            ${!r.opts[g.pick].ok && r.why ? `<p>🤔 It looks right because: ${fmt(cap(r.why))}</p>` : ''}
            ${r.clue ? `<p>🎯 <b>Decisive clue:</b> ${fmt(cap(r.clue))}</p>` : ''}
            ${r.exam ? `<p>📝 <b>In the exam:</b> ${fmt(cap(r.exam))}</p>` : ''}
          </div>
          <button class="btn start next" data-a="game-next">Next ▶</button>`}
      </article>`;
  }

  /* ---- Number Rush */
  const RUSH_SECONDS = 60;
  function startRush() {
    openGame({ kind: 'rush', pool: shuffle(rushPool(current)), left: RUSH_SECONDS, combo: 0, maxCombo: 0, right: 0, asked: 0, q: null, locked: false });
    nextRushQuestion();
    game.timer = setInterval(() => {
      if (!game || game.kind !== 'rush') return;
      game.left--;
      const bar = $('#rushBar');
      if (bar) { bar.style.width = `${(game.left / RUSH_SECONDS) * 100}%`; $('#rushTime').textContent = `${game.left}s`; }
      if (game.left <= 0) { clearInterval(game.timer); game.timer = null; endRush(); }
    }, 1000);
  }
  function nextRushQuestion() {
    const g = game;
    const item = g.pool[g.asked % g.pool.length];
    const others = shuffle(g.pool.filter(p => p.a !== item.a)).slice(0, 3).map(p => p.a);
    g.q = { ...item, opts: shuffle([item.a, ...others]) };
    g.pick = null; g.locked = false; g.asked++;
    renderRush();
  }
  function renderRush() {
    const g = game;
    if (!g.q) return;
    $('#study').innerHTML = `
      <div class="study-top">
        <button class="btn small ghost" data-a="game-quit">✕ Quit</button>
        <div class="bar rush"><div id="rushBar" style="width:${(g.left / RUSH_SECONDS) * 100}%"></div></div>
        <span id="rushTime">${g.left}s</span>
      </div>
      <div class="rush-score"><span>⭐ <b>${g.score}</b></span>${g.combo >= 2 ? `<span class="combo">🔥 Combo ×${g.combo}</span>` : ''}</div>
      <article class="game-card gc-rush">
        <span class="gc-tag">⏱️ Number Rush</span>
        <h2>${esc(g.q.q)}</h2>
        <div class="opts">${g.q.opts.map((o, i) => {
          const cls = g.pick == null ? '' : o === g.q.a ? 'right' : i === g.pick ? 'wrong' : 'dim';
          return `<button class="opt-btn ${cls}" data-a="rush-pick" data-i="${i}" ${g.pick == null ? '' : 'disabled'}>${fmt(o)}</button>`;
        }).join('')}</div>
      </article>`;
  }
  function rushPick(i) {
    const g = game;
    if (g.locked) return;
    g.locked = true; g.pick = i;
    const ok = g.q.opts[i] === g.q.a;
    if (ok) { g.combo++; g.right++; g.maxCombo = Math.max(g.maxCombo, g.combo); g.score += 10 + (g.combo >= 3 ? 5 : 0); }
    else g.combo = 0;
    renderRush();
    setTimeout(() => { if (game === g && g.left > 0) nextRushQuestion(); }, ok ? 450 : 1300);
  }
  function endRush() {
    const g = game;
    const isBest = setBest(g.sys, 'rush', g.score);
    if (g.score >= 100) award('rush100');
    gameOver(g.score >= 150 ? '🚀' : g.score >= 100 ? '⚡' : '⏱️', `${g.score} points`,
      [`${g.right} right out of ${g.asked} · best combo ×${g.maxCombo}`, isBest ? '🏆 New best!' : `Best: ${best(g.sys, 'rush')}`], Math.round(g.score / 2), 'rush');
  }

  /* ---- Sequence Builder */
  function startSeq() {
    const rounds = shuffle(seqPool(current)).slice(0, 5);
    openGame({ kind: 'seq', rounds, stars: 0, placed: [], mistakes: 0, order: null, shake: null });
    prepSeqRound();
    renderSeq();
  }
  function prepSeqRound() {
    const r = game.rounds[game.i];
    if (!r) return;
    game.placed = []; game.mistakes = 0; game.shake = null;
    let order = shuffle(r.steps.map((_, i) => i));
    if (order.every((v, i) => v === i)) order = order.reverse();
    game.order = order;
  }
  function renderSeq() {
    const g = game, n = g.rounds.length;
    if (g.i >= n) {
      const pct = Math.round((g.stars / (n * 3)) * 100);
      const isBest = setBest(g.sys, 'seq', pct);
      return gameOver(pct === 100 ? '🧩' : pct >= 70 ? '⭐' : '🔁', `${g.stars} / ${n * 3} stars`,
        [pct === 100 ? 'Every algorithm in perfect order!' : 'Replay to turn every algorithm into 3 stars.', isBest ? '🏆 New best!' : ''], g.stars * 5, 'seq');
    }
    const r = g.rounds[g.i];
    const done = g.placed.length === r.steps.length;
    const stars = g.mistakes === 0 ? 3 : g.mistakes <= 2 ? 2 : 1;
    $('#study').innerHTML = `${gameTop((g.i / n) * 100, `⭐ ${g.stars} · ${g.i + 1}/${n}`)}
      <article class="game-card gc-seq">
        <span class="gc-tag">🧩 Sequence Builder</span>
        <h2>${esc(r.title)}</h2>
        <p class="gc-ask">${done ? '' : `Tap step <b>${g.placed.length + 1}</b> of ${r.steps.length}`}${g.mistakes ? ` <span class="mist">✗ ${g.mistakes}</span>` : ''}</p>
        <ol class="seq-placed">${g.placed.map(i => `<li><span class="stepn">${i + 1}</span><span>${fmt(r.steps[i])}</span></li>`).join('')}</ol>
        ${done ? `
          <div class="gc-feedback good"><b>${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)} ${stars === 3 ? 'Perfect order!' : 'Done!'}</b></div>
          <button class="btn start next" data-a="seq-next">Next ▶</button>`
        : `<div class="seq-pool">${g.order.filter(i => !g.placed.includes(i)).map(i =>
            `<button class="seq-chip ${g.shake === i ? 'shake' : ''}" data-a="seq-pick" data-i="${i}">${fmt(r.steps[i])}</button>`).join('')}</div>`}
      </article>`;
  }
  function seqPick(i) {
    const g = game;
    if (i === g.placed.length) { g.placed.push(i); g.shake = null; }
    else { g.mistakes++; g.shake = i; }
    renderSeq();
  }
  function seqNext() {
    const g = game;
    const stars = g.mistakes === 0 ? 3 : g.mistakes <= 2 ? 2 : 1;
    g.stars += stars;
    if (stars === 3) { player.stats.perfectSeq = (player.stats.perfectSeq || 0) + 1; savePlayer(); if (player.stats.perfectSeq >= 5) award('seqPro'); }
    g.i++;
    prepSeqRound();
    renderSeq();
  }

  /* -------------------------------------------------------- fact modal */
  let openId = null;

  function showFact(id) {
    const c = cards.find(x => x.id === id);
    if (!c) return;
    openId = id;
    $('#modalForm').innerHTML = `
      ${cardHTML(c)}
      <div class="actions">
        <button value="close" class="btn small ghost">Close</button>
        <span class="spacer"></span>
        <button type="button" class="btn forgot-btn" data-a="m-forgot">😕 Forgot</button>
        <button type="button" class="btn knew-btn" data-a="m-knew">😊 Knew it</button>
      </div>`;
    if (!$('#modal').open) $('#modal').showModal();
  }

  /* ------------------------------------------------------------ events */
  document.addEventListener('click', e => {
    const t = e.target;
    const fact = t.closest('#system [data-fact]');
    if (fact && !t.closest('label')) return showFact(fact.dataset.fact);

    const fb = t.closest('#filters button');
    if (fb) { filter = fb.dataset.f; return renderSystem(); }

    const a = t.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'show') { session.shown = true; renderStudy(); }
    else if (a === 'knew') answer(true);
    else if (a === 'forgot') answer(false);
    else if (a === 'home') endStudy();
    else if (a === 'study-sys') startStudy(current);
    else if (a === 'print') window.print();
    else if (a === 'badges') showBadges();
    else if (a === 'play-trap') startTrapHunter();
    else if (a === 'play-rush') startRush();
    else if (a === 'play-seq') startSeq();
    else if (a === 'game-quit') closeGame();
    else if (a === 'game-next') { game.i++; game.pick = null; renderGame(); }
    else if (a === 'trap-pick' && game.pick == null) {
      game.pick = +t.closest('[data-a]').dataset.i;
      if (game.rounds[game.i].opts[game.pick].ok) game.score++;
      renderGame();
    }
    else if (a === 'rush-pick') rushPick(+t.closest('[data-a]').dataset.i);
    else if (a === 'seq-pick') seqPick(+t.closest('[data-a]').dataset.i);
    else if (a === 'seq-next') seqNext();
    else if (a === 'trap-toggle') {
      const card = t.closest('.tn-card');
      const open = card.classList.toggle('open');
      t.closest('[data-a]').textContent = open ? '🙈 Hide the rule' : '👀 Show the rule';
    } else if (a === 'traps-all') {
      const btn = t.closest('[data-a]');
      const open = !btn.classList.contains('on');
      btn.classList.toggle('on', open);
      btn.textContent = open ? '🙈 Hide all rules' : '👀 Show all rules';
      document.querySelectorAll('.tn-card').forEach(c => {
        c.classList.toggle('open', open);
        c.querySelector('.tn-reveal').textContent = open ? '🙈 Hide the rule' : '👀 Show the rule';
      });
    }
    else if (a === 'm-knew' || a === 'm-forgot') {
      grade(cards.find(x => x.id === openId), a === 'm-knew');
      $('#modal').close(); refresh();
      toast(a === 'm-knew' ? '😊 Marked as known' : '😕 Will come back in review');
    }
  });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').close(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.activeElement.matches('#system [data-fact]')) return showFact(document.activeElement.dataset.fact);
    if (game && e.key === 'Escape' && !$('#modal').open) return closeGame();
    if (!session || $('#modal').open) return;
    if (!session.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); session.shown = true; renderStudy(); }
    else if (session.shown && (e.key === 'ArrowRight' || e.key === '2')) answer(true);
    else if (session.shown && (e.key === 'ArrowLeft' || e.key === '1')) answer(false);
    else if (e.key === 'Escape') endStudy();
  });

  $('#startAllBtn').addEventListener('click', () => startStudy(null));
  $('#playerChip').addEventListener('click', showBadges);
  $('#search').addEventListener('input', e => { query = e.target.value.trim(); renderSystem(); });
  // trap search filters the rendered cards in place (keeps focus and reveal state)
  document.addEventListener('input', e => {
    if (e.target.id !== 'trapSearch') return;
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.tn-card').forEach(c => { c.hidden = !!q && !c.textContent.toLowerCase().includes(q); });
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Reset your review progress, XP, streak and badges? The decks and notes are not affected.')) return;
    progress = {}; saveProgress();
    player = freshPlayer(); savePlayer();
    cards.forEach(c => Object.assign(c, { status: 'amber', streak: 0, misses: 0, due: 0 }));
    refresh(); toast('Progress reset');
  });

  window.addEventListener('hashchange', route);

  loadContent().then(() => {
    document.body.classList.remove('loading');
    route();
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
