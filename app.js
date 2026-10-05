/* Volatile Facts Deck — systems → fact decks (vanilla JS, data in localStorage). */
(function () {
  'use strict';

  const { TYPES, parseDocx, buildCard, parseLine } = window.FactParser;
  const SYSTEMS = window.FACTDECK_SYSTEMS;
  const SYS = Object.fromEntries(SYSTEMS.map(s => [s.id, s]));
  const KEY = 'factdeck.v3';
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
  const uid = () => Math.random().toString(36).slice(2, 10);
  const now = () => Date.now();
  const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ------------------------------------------------------------ data */
  let cards = load();

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(s)) return s.filter(c => SYS[c.system]);
    } catch (_) { /* use sample */ }
    return fromRaw(window.FACTDECK_SEED, true);
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(cards)); }

  // Parsed sections → fact cards. Guide/how-to boxes are skipped.
  function fromRaw(raw, useSeedStatus, system) {
    const out = [];
    for (const sec of raw.sections) for (const rc of sec.cards) {
      const c = buildCard(rc.heading, rc.lines, sec.title);
      if (c.type === 'guide' || !c.lines.length) continue;
      const status = (useSeedStatus && rc.status) || 'amber';
      out.push({ id: uid(), ...c, system: system || sec.system, status, streak: status === 'green' ? 2 : 0, misses: status === 'red' ? 1 : 0, due: now() });
    }
    return out;
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
    save();
  }

  const inScope = sys => c => !sys || c.system === sys;
  const dueCards = sys => cards.filter(c => inScope(sys)(c) && ACTIVE.includes(c.status) && c.due <= now());
  const activeCards = sys => cards.filter(c => inScope(sys)(c) && ACTIVE.includes(c.status));
  const countGroup = (list, g) => list.filter(c => STATUS[c.status].group === g).length;

  /* --------------------------------------------------------- rendering */
  const NUM_RE = /(\d+(?:[.,]\d+)?(?:\s?[–-]\s?\d+(?:[.,]\d+)?)?(?:\s?(?:mg PE\/kg|mg\/kg|mcg\/kg|mL\/kg|g\/kg|mg\/m²|mg\/dL|mg\/mL|mL\/h|g\/g|mg|mcg|mL|g|kg|h|hours?|days?|weeks?|min|s|%)(?![A-Za-z]))?)/g;
  const fmt = t => esc(t).replace(NUM_RE, '<b class="num">$1</b>');

  const TAG = { trap: '⚠️ Trap', cue: '💡 Tip', clue: '🎯 Key clue', tempting: '🪤 Tempting' };
  function linesHTML(lines) {
    return '<ul class="lines">' + lines.map(l => {
      if (TAG[l.k]) return `<li class="ln ${l.k}"><b class="tag">${TAG[l.k]}</b> ${fmt(l.t)}</li>`;
      if (l.k === 'step') return `<li class="ln step"><span class="stepn">${l.n}</span><span>${fmt(l.t)}</span></li>`;
      if (l.k === 'check') return `<li class="ln check"><label><input type="checkbox" /> <span>${fmt(l.t)}</span></label></li>`;
      const formula = /\s=\s/.test(l.t) && /[×÷*\d]/.test(l.t);
      return `<li class="ln ${formula ? 'formula' : 'text'}">${fmt(l.t)}</li>`;
    }).join('') + '</ul>';
  }
  const sourceHTML = c => c.trace ? `<p class="source">📍 ${esc(c.trace.replace(/\s*>\s*/g, ' › '))}</p>` : '';
  const typeHTML = c => `<span class="type">${TYPES[c.type].icon} ${esc(TYPES[c.type].label)}</span>`;
  const statusHTML = c => `<span class="status st-${c.status}">${STATUS[c.status].word}</span>`;
  const sysChip = id => `<span class="sys-chip" style="--s:${SYS[id].color}">${SYS[id].icon} ${esc(SYS[id].name)}</span>`;

  function cardHTML(c) {
    return `<article class="card t-${c.type}" data-id="${c.id}" tabindex="0">
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

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ------------------------------------------------------------ router */
  let current = null; // system id being viewed, or null for home

  function route() {
    const m = location.hash.match(/^#s\/([\w-]+)/);
    current = m && SYS[m[1]] ? m[1] : null;
    if (session) { session = null; $('#study').hidden = true; }
    $('#home').hidden = !!current;
    $('#system').hidden = !current;
    if (current) { filter = 'all'; query = ''; $('#search').value = ''; renderSystem(); }
    else renderHome();
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
      : 'Open a system below and upload its fact deck (.docx).';
    $('#startAllBtn').textContent = due ? '▶ Review all due' : '↻ Practise all systems';
    $('#startAllBtn').disabled = !activeCards().length;
    $('#counts').innerHTML = cards.length ? countsHTML(cards) : '';

    $('#systems').innerHTML = SYSTEMS.map(s => {
      const list = cards.filter(c => c.system === s.id);
      const d = dueCards(s.id).length;
      const mastered = countGroup(list, 'mastered');
      const pct = list.length ? Math.round((mastered / list.length) * 100) : 0;
      return `<a class="sys" href="#s/${s.id}" style="--s:${s.color}">
        <span class="sys-ico">${s.icon}</span>
        <span class="sys-body">
          <b class="sys-name">${esc(s.name)}</b>
          <span class="sys-meta">${list.length
            ? `${plural(list.length, 'fact')}${d ? ` · <em>${d} due</em>` : ' · ✓ up to date'}`
            : '<i>No deck yet. Tap to upload</i>'}</span>
          ${list.length ? `<span class="sys-bar" title="${pct}% mastered"><span style="width:${pct}%"></span></span>` : ''}
        </span>
        <span class="sys-go">›</span>
      </a>`;
    }).join('');
  }

  /* ------------------------------------------------------------ system */
  let filter = 'all';
  let query = '';

  function renderSystem() {
    const s = SYS[current];
    const list = cards.filter(c => c.system === current);
    const due = dueCards(current).length;
    const active = activeCards(current).length;
    document.title = `${s.name} · Volatile Facts Deck`;

    $('#sysHero').style.setProperty('--s', s.color);
    $('#sysHero').innerHTML = `
      <div class="sh-top">
        <span class="sh-ico">${s.icon}</span>
        <div>
          <h1>${esc(s.name)}</h1>
          <p>${list.length
            ? (due ? `<b>${plural(due, 'fact')}</b> to review today` : 'All done for today 🎉')
            : 'No fact deck yet. Upload this system’s .docx to begin.'}</p>
        </div>
      </div>
      <div class="sh-actions">
        ${list.length ? `<button class="btn start" data-a="study-sys" ${active ? '' : 'disabled'}>${due ? '▶ Start Review' : '↻ Practise again'}</button>` : ''}
        <button class="btn upload" data-a="upload">📄 ${list.length ? 'Upload / update deck' : 'Upload fact deck'}</button>
      </div>
      ${list.length ? `<div class="counts">${countsHTML(list)}</div>` : ''}`;

    $('.facts').hidden = !list.length;
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

  /* ------------------------------------------------------------ upload */
  let pending = null;
  const factKey = c => c.title.toLowerCase().replace(/\s+/g, ' ').trim();

  function pickFile(accept) {
    const inp = $('#fileInput');
    inp.accept = accept;
    inp.click();
  }

  async function handleFile(file) {
    if (!file) return;
    try {
      if (/\.json$/i.test(file.name)) {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data)) throw new Error('This is not a Facts Deck backup');
        if (!confirm(`Restore ${plural(data.length, 'fact')} from this backup? Everything now on this device will be replaced.`)) return;
        cards = data.filter(c => SYS[c.system]); save(); refresh(); toast('✓ Backup restored');
        return;
      }
      if (!current) throw new Error('Open a system first, then upload its deck');
      if (!/\.docx$/i.test(file.name)) throw new Error('Please choose a Word (.docx) file');
      const found = fromRaw(await parseDocx(await file.arrayBuffer()), false, current);
      if (!found.length) throw new Error('No facts found in this document');
      const mine = cards.filter(c => c.system === current);
      const have = new Set(mine.map(factKey));
      const incoming = new Set(found.map(factKey));
      pending = {
        name: file.name, sys: current, cards: found,
        fresh: found.filter(c => !have.has(factKey(c))).length,
        updated: found.filter(c => have.has(factKey(c))).length,
        dropped: mine.filter(c => !incoming.has(factKey(c))).length,
      };
      showUpload();
    } catch (err) {
      toast('⚠️ ' + err.message);
      console.error(err);
    }
  }

  function showUpload() {
    const p = pending;
    const s = SYS[p.sys];
    const sections = [...new Set(p.cards.map(c => c.section))];
    const hasDeck = p.updated + p.dropped > 0;
    $('#modalForm').innerHTML = `
      <h2>📄 ${esc(p.name)}</h2>
      <p>For ${sysChip(s.id)}</p>
      <p>Found <b>${plural(p.cards.length, 'fact')}</b>: ${p.fresh} new${p.updated ? `, ${p.updated} already in this deck` : ''}.</p>
      <div class="upload-list">
        ${sections.map(sec => `<h4 class="section">${esc(sec)}</h4>
          <ul>${p.cards.filter(c => c.section === sec).map(c => `<li class="t-${c.type}">${TYPES[c.type].icon} ${esc(c.title)}</li>`).join('')}</ul>`).join('')}
      </div>
      ${hasDeck ? `<div class="choice">
          <button type="button" class="opt" data-a="replace"><b>🔄 Replace with this version</b>
            <small>Use this when the document is the updated deck for ${esc(s.name)}. Facts that are still in it keep their progress${p.dropped ? `; <b>${plural(p.dropped, 'fact')}</b> not in this file will be removed` : ''}.</small></button>
          <button type="button" class="opt" data-a="merge"><b>＋ Add to the current deck</b>
            <small>Keep everything already here and add the new facts.</small></button>
        </div>
        <div class="actions"><span class="spacer"></span><button value="cancel" class="btn ghost">Cancel</button></div>`
      : `<div class="actions"><span class="spacer"></span>
          <button value="cancel" class="btn ghost">Cancel</button>
          <button type="button" class="btn start" data-a="merge">Add ${plural(p.cards.length, 'fact')}</button>
        </div>`}`;
    openModal();
  }

  function applyUpload(replace) {
    const p = pending;
    const mine = cards.filter(c => c.system === p.sys);
    const byKey = new Map(mine.map(c => [factKey(c), c]));
    const keep = new Set();
    for (const c of p.cards) {
      const old = byKey.get(factKey(c));
      if (old) { Object.assign(old, { lines: c.lines, trace: c.trace, type: c.type, section: c.section }); keep.add(old.id); }
      else { cards.push(c); keep.add(c.id); }
    }
    if (replace) cards = cards.filter(c => c.system !== p.sys || keep.has(c.id));
    toast(replace ? `✓ ${SYS[p.sys].name} deck updated` : `✓ ${plural(p.fresh, 'new fact')} added`);
    pending = null;
    save(); closeModal(); refresh();
  }

  /* -------------------------------------------------------- fact modal */
  const PREFIX = { trap: 'Trap: ', cue: 'Cue: ', clue: 'Decisive clue: ', tempting: 'Tempting: ', check: '☐ ' };
  const lineText = l => l.k === 'step' ? `${l.n}. ${l.t}` : (PREFIX[l.k] || '') + l.t;
  let editingId = null;

  function showFact(id) {
    const c = cards.find(x => x.id === id);
    editingId = id;
    $('#modalForm').innerHTML = `
      ${cardHTML(c)}
      <div class="actions">
        <button type="button" class="btn small ghost" data-a="edit">✏️ Edit</button>
        <span class="spacer"></span>
        <button type="button" class="btn forgot-btn" data-a="m-forgot">😕 Forgot</button>
        <button type="button" class="btn knew-btn" data-a="m-knew">😊 Knew it</button>
      </div>`;
    openModal();
  }

  function editFact(id) {
    const firstSection = cards.find(x => x.system === current)?.section || 'My facts';
    const c = id ? cards.find(x => x.id === id) : { title: '', lines: [], trace: '', section: firstSection };
    editingId = id;
    $('#modalForm').innerHTML = `
      <h2>${id ? 'Edit fact' : `Add a fact to ${esc(SYS[current].name)}`}</h2>
      <label>Question<input name="title" required value="${esc(c.title)}" placeholder="e.g. NRP epinephrine IV dose?" /></label>
      <label>Answer <small>(one point per line; start a line with “Trap:” to highlight it)</small>
        <textarea name="lines" rows="6">${esc(c.lines.map(lineText).join('\n'))}</textarea></label>
      <label>Topic<input name="section" value="${esc(c.section)}" /></label>
      <label>Source <small>(optional, e.g. Day 5 › Ventilation)</small><input name="trace" value="${esc(c.trace)}" /></label>
      <div class="actions">
        ${id ? '<button type="button" class="btn small danger" data-a="delete">Delete</button>' : ''}
        <span class="spacer"></span>
        <button value="cancel" class="btn ghost" formnovalidate>Cancel</button>
        <button type="submit" class="btn start">Save</button>
      </div>`;
    openModal();
  }

  function saveFact() {
    const f = new FormData($('#modalForm'));
    const title = String(f.get('title')).trim();
    const section = String(f.get('section')).trim() || 'My facts';
    const lines = String(f.get('lines')).split('\n').map(s => s.trim()).filter(Boolean);
    const built = buildCard(title, lines.concat(f.get('trace') ? ['↩ ' + f.get('trace')] : []), section);
    const patch = { title, section, lines: lines.map(parseLine), trace: built.trace, type: built.type };
    const c = cards.find(x => x.id === editingId);
    if (c) Object.assign(c, patch);
    else cards.push({ id: uid(), ...patch, system: current, status: 'amber', streak: 0, misses: 0, due: now() });
    save(); closeModal(); refresh(); toast('✓ Saved');
  }

  const openModal = () => { if (!$('#modal').open) $('#modal').showModal(); };
  const closeModal = () => $('#modal').close();

  /* ------------------------------------------------------------ events */
  document.addEventListener('click', e => {
    const t = e.target;
    const card = t.closest('#list .card');
    if (card && !t.closest('label')) return showFact(card.dataset.id);

    const fb = t.closest('#filters button');
    if (fb) { filter = fb.dataset.f; return renderSystem(); }

    const a = t.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'show') { session.shown = true; renderStudy(); }
    else if (a === 'knew') answer(true);
    else if (a === 'forgot') answer(false);
    else if (a === 'home') endStudy();
    else if (a === 'study-sys') startStudy(current);
    else if (a === 'upload') pickFile('.docx');
    else if (a === 'merge') applyUpload(false);
    else if (a === 'replace') applyUpload(true);
    else if (a === 'edit') editFact(editingId);
    else if (a === 'm-knew' || a === 'm-forgot') {
      grade(cards.find(x => x.id === editingId), a === 'm-knew');
      closeModal(); refresh(); toast(a === 'm-knew' ? '😊 Marked as known' : '😕 Will come back in review');
    } else if (a === 'delete' && confirm('Delete this fact?')) {
      cards = cards.filter(x => x.id !== editingId);
      save(); closeModal(); refresh();
    }
  });

  $('#modalForm').addEventListener('submit', e => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    if ($('#modalForm [name=title]')) saveFact();
  });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  document.addEventListener('keydown', e => {
    if (!session || $('#modal').open) return;
    if (!session.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); session.shown = true; renderStudy(); }
    else if (session.shown && (e.key === 'ArrowRight' || e.key === '2')) answer(true);
    else if (session.shown && (e.key === 'ArrowLeft' || e.key === '1')) answer(false);
    else if (e.key === 'Escape') endStudy();
  });

  $('#startAllBtn').addEventListener('click', () => startStudy(null));
  $('#addBtn').addEventListener('click', () => editFact(null));
  $('#search').addEventListener('input', e => { query = e.target.value.trim(); renderSystem(); });
  $('#fileInput').addEventListener('change', e => { handleFile(e.target.files[0]); e.target.value = ''; });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); });

  $('#exportBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(cards)], { type: 'application/json' }));
    a.download = `facts-deck-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });
  $('#restoreBtn').addEventListener('click', () => pickFile('.json'));
  $('#sampleBtn').addEventListener('click', () => {
    if (!confirm('Replace all facts with the sample facts?')) return;
    cards = fromRaw(window.FACTDECK_SEED, true); save(); refresh();
  });
  $('#clearBtn').addEventListener('click', () => {
    if (!confirm('Delete all facts and progress in every system?')) return;
    cards = []; save(); refresh();
  });

  window.addEventListener('hashchange', route);
  save();
  route();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
