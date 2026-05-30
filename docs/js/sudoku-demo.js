// ─────────────────────────────────────────────────────────
// Sudoku ZKP — Interactive Demo
// Uses Web Crypto API for real SHA-256 hashes
// ─────────────────────────────────────────────────────────

// Known puzzle (0 = empty)
const PRESET = [
  5,3,0,0,7,0,0,0,0,
  6,0,0,1,9,5,0,0,0,
  0,9,8,0,0,0,0,6,0,
  8,0,0,0,6,0,0,0,3,
  4,0,0,8,0,3,0,0,1,
  7,0,0,0,2,0,0,0,6,
  0,6,0,0,0,0,2,8,0,
  0,0,0,4,1,9,0,0,5,
  0,0,0,0,8,0,0,7,9
];

// Complete solution
const SOLUTION = [
  5,3,4,6,7,8,9,1,2,
  6,7,2,1,9,5,3,4,8,
  1,9,8,3,4,2,5,6,7,
  8,5,9,7,6,1,4,2,3,
  4,2,6,8,5,3,7,9,1,
  7,1,3,9,2,4,8,5,6,
  9,6,1,5,3,7,2,8,4,
  2,8,7,4,1,9,6,3,5,
  3,4,5,2,8,6,1,7,9
];

// ── State ──────────────────────────────────────────────
const PHASE_ORDER = ['setup', 'committed', 'challenge', 'revealed', 'verified'];
let phase          = 'setup';
let perm           = null;   // perm[d] = permuted digit (indices 1–9)
let nonces         = null;   // String[81]
let hashes         = null;   // String[81]  hex SHA-256
let permuted       = null;   // Number[81]  permuted solution
let challengeType  = 'row';
let challengeIdx   = 0;
let orangeIdxs     = [];
let greenIdxs      = [];
let rounds         = 0;

// ── Crypto helpers ─────────────────────────────────────
async function sha256(str) {
  const buf    = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomPerm() {
  const p = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = 9; i > 1; i--) {
    const j = 1 + Math.floor(Math.random() * i);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

function randomNonce() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

// ── Index helpers ──────────────────────────────────────
function getOrangeIndices(type, idx) {
  if (type === 'row')    return Array.from({length: 9}, (_, c) => idx * 9 + c);
  if (type === 'column') return Array.from({length: 9}, (_, r) => r * 9 + idx);
  if (type === 'square') {
    const br = Math.floor(idx / 3) * 3, bc = (idx % 3) * 3;
    return Array.from({length: 9}, (_, k) => (br + Math.floor(k / 3)) * 9 + bc + (k % 3));
  }
  if (type === 'preset') return PRESET.map((v, i) => v ? i : -1).filter(i => i >= 0);
  return [];
}

function getGreenIndices(orangeSet) {
  const presetDigitsInOrange = new Set(
    orangeSet.filter(i => PRESET[i]).map(i => PRESET[i])
  );
  return Array.from({length: 81}, (_, i) => i).filter(
    i => !orangeSet.includes(i) && PRESET[i] && presetDigitsInOrange.has(PRESET[i])
  );
}

// ── Grid construction (runs once) ─────────────────────
function buildGrid() {
  const wrap  = document.getElementById('sudokuGridWrap');
  const table = document.createElement('table');
  table.className = 'sudoku-grid';
  for (let r = 0; r < 9; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < 9; c++) {
      const td = document.createElement('td');
      td.className = 'sudoku-cell';
      td.id = `sc-${r * 9 + c}`;
      if (c === 2 || c === 5) td.classList.add('box-right');
      if (r === 2 || r === 5) td.classList.add('box-bottom');
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  wrap.appendChild(table);
}

function renderGrid() {
  for (let i = 0; i < 81; i++) {
    const el = document.getElementById(`sc-${i}`);
    if (!el) continue;

    // Clear state classes
    el.classList.remove('is-preset', 'is-locked', 'hl-orange', 'hl-green', 'hl-reveal');
    el.title = '';

    const isPreset    = PRESET[i] !== 0;
    const isOrange    = orangeIdxs.includes(i);
    const isGreen     = greenIdxs.includes(i);
    const isRevealed  = isOrange || isGreen;

    if (phase === 'setup') {
      el.textContent = isPreset ? PRESET[i] : '';
      if (isPreset) el.classList.add('is-preset');

    } else if (phase === 'committed') {
      el.textContent = isPreset ? PRESET[i] : '·';
      el.classList.add(isPreset ? 'is-preset' : 'is-locked');

    } else if (phase === 'challenge') {
      el.textContent = isPreset ? PRESET[i] : '·';
      el.classList.add(isPreset ? 'is-preset' : 'is-locked');
      if (isOrange) el.classList.add('hl-orange');
      if (isGreen)  el.classList.add('hl-green');

    } else if (phase === 'revealed' || phase === 'verified') {
      if (isRevealed) {
        el.textContent = permuted[i];
        el.classList.add('hl-reveal');
        if (isGreen) el.classList.add('hl-green');
        if (hashes?.[i]) el.title = hashes[i];
      } else if (isPreset) {
        el.textContent = PRESET[i];
        el.classList.add('is-preset');
      } else {
        el.textContent = '·';
        el.classList.add('is-locked');
      }
    }
  }
}

// ── Commit mini-grid ───────────────────────────────────
function buildCommitGrid(containerId, highlightSet = []) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('div');
    cell.className = 'commit-cell';
    if (hashes?.[i]) {
      cell.textContent = hashes[i].slice(0, 4);
      cell.title       = hashes[i];
      cell.classList.add('filled');
    }
    if (highlightSet.includes(i)) cell.classList.add('highlighted');
    el.appendChild(cell);
  }
}

// ── Permutation map display ────────────────────────────
function renderPermMap() {
  const el = document.getElementById('permMap');
  el.innerHTML = '';
  for (let d = 1; d <= 9; d++) {
    const chip = document.createElement('div');
    chip.className = 'perm-chip';
    chip.innerHTML = `${d}<span class="arr">→</span>${perm[d]}`;
    el.appendChild(chip);
  }
}

// ── Phase bar ──────────────────────────────────────────
function updatePhaseBar() {
  const idx = PHASE_ORDER.indexOf(phase);
  for (let i = 0; i < 5; i++) {
    const el = document.getElementById(`ps${i}`);
    el.classList.remove('current', 'done');
    if (i < idx)  el.classList.add('done');
    if (i === idx) el.classList.add('current');
  }
}

// ── Panel switcher ─────────────────────────────────────
function showPanel(id) {
  ['panelSetup','panelCommitted','panelChallenge','panelRevealed','panelVerified'].forEach(p => {
    document.getElementById(p).style.display = (p === id) ? '' : 'none';
  });
}

// ── UI helpers ─────────────────────────────────────────
function setMsg(html)    { document.getElementById('demoMsg').innerHTML = html; }
function setBtn(t, off)  { const b = document.getElementById('actionBtn'); b.textContent = t; b.disabled = !!off; }
function showReset(v)    { document.getElementById('resetBtn').style.display = v ? '' : 'none'; }

// ── Challenge controls ─────────────────────────────────
function initChallengeControls() {
  document.querySelectorAll('.ctype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      challengeType = btn.dataset.t;
      challengeIdx  = 0;
      document.querySelectorAll('.ctype-btn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      rebuildIndexRow();
      updateChallengeSelection();
    });
  });
}

function rebuildIndexRow() {
  const row   = document.getElementById('idxRow');
  row.innerHTML = '';
  if (challengeType === 'preset') return;
  for (let i = 0; i < 9; i++) {
    const btn = document.createElement('button');
    btn.className   = 'idx-btn' + (i === challengeIdx ? ' sel' : '');
    btn.textContent = i + 1;
    btn.addEventListener('click', () => {
      challengeIdx = i;
      document.querySelectorAll('.idx-btn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      updateChallengeSelection();
    });
    row.appendChild(btn);
  }
}

function updateChallengeSelection() {
  orangeIdxs = getOrangeIndices(challengeType, challengeIdx);
  greenIdxs  = (challengeType !== 'preset') ? getGreenIndices(orangeIdxs) : [];

  const labels = {
    row: `Row ${challengeIdx + 1}`,
    column: `Column ${challengeIdx + 1}`,
    square: `Box ${challengeIdx + 1}`,
    preset: 'all preset cells'
  };
  document.getElementById('challengeHint').textContent =
    `Victor challenges ${labels[challengeType]} — ${[...orangeIdxs, ...greenIdxs].length} cells will be opened.`;

  renderGrid();
  buildCommitGrid('commitMiniGrid2', [...orangeIdxs, ...greenIdxs]);
}

// ── Main action dispatcher ─────────────────────────────
async function handleAction() {
  if (phase === 'setup')     await doCommit();
  else if (phase === 'committed') doChallenge();
  else if (phase === 'challenge') doReveal();
  else if (phase === 'revealed') await doVerify();
  else if (phase === 'verified') await doNextRound();
}

// ── Phase: Commit ──────────────────────────────────────
async function doCommit() {
  setBtn('Computing hashes…', true);
  setMsg('Peggy is generating a random permutation and computing 81 SHA-256 commitments…');
  await tick();

  perm     = randomPerm();
  nonces   = Array.from({length: 81}, randomNonce);
  permuted = SOLUTION.map(d => perm[d]);
  hashes   = await Promise.all(permuted.map((d, i) => sha256(`${d}-${nonces[i]}`)));

  phase = 'committed';
  renderPermMap();
  buildCommitGrid('commitMiniGrid');
  renderGrid();
  showPanel('panelCommitted');
  updatePhaseBar();
  setMsg('Peggy committed her permuted solution. Victor holds 81 hash envelopes — he cannot see the digits inside.');
  setBtn('Victor Chooses a Challenge →');
  showReset(true);
}

// ── Phase: Challenge ───────────────────────────────────
function doChallenge() {
  phase = 'challenge';
  challengeType = 'row';
  challengeIdx  = 0;

  // Reset type buttons
  document.querySelectorAll('.ctype-btn').forEach(b => b.classList.remove('sel'));
  document.querySelector('[data-t="row"]').classList.add('sel');

  rebuildIndexRow();
  updateChallengeSelection();  // sets orangeIdxs, greenIdxs, calls renderGrid

  showPanel('panelChallenge');
  updatePhaseBar();
  setMsg('Victor selects which row, column, box, or preset cells Peggy must open. Choose below, then click <strong>Challenge →</strong>.');
  setBtn('Challenge →');
}

// ── Phase: Reveal ──────────────────────────────────────
function doReveal() {
  phase = 'revealed';
  renderGrid();
  showPanel('panelRevealed');
  updatePhaseBar();

  const allRevealed = [...new Set([...orangeIdxs, ...greenIdxs])];
  const tbody = document.getElementById('revealedBody');
  tbody.innerHTML = '';
  allRevealed.forEach(i => {
    const r  = Math.floor(i / 9) + 1, c = (i % 9) + 1;
    const tr = document.createElement('tr');
    tr.className = greenIdxs.includes(i) ? 'reveal-row-green' : 'reveal-row-orange';
    tr.innerHTML =
      `<td>(${r},${c})</td>` +
      `<td>${permuted[i]}</td>` +
      `<td>${nonces[i].slice(0, 10)}…</td>` +
      `<td>${hashes[i].slice(0, 10)}…</td>`;
    tbody.appendChild(tr);
  });

  const typeLabel = {row:'Row', column:'Column', square:'Box', preset:'Presets'}[challengeType];
  const idxLabel  = challengeType === 'preset' ? '' : ` ${challengeIdx + 1}`;
  setMsg(`Peggy opened ${allRevealed.length} commitments for <strong>${typeLabel}${idxLabel}</strong>. Victor can now verify.`);
  setBtn('Verify →');
}

// ── Phase: Verify ──────────────────────────────────────
async function doVerify() {
  setBtn('Verifying…', true);
  await tick();

  const allRevealed = [...new Set([...orangeIdxs, ...greenIdxs])];

  // 1. Hash check
  let hashOk = true;
  for (const i of allRevealed) {
    const expected = await sha256(`${permuted[i]}-${nonces[i]}`);
    if (expected !== hashes[i]) { hashOk = false; break; }
  }

  // 2. Distinct digits in the challenged group
  let distinctOk = true;
  if (challengeType !== 'preset') {
    const vals = orangeIdxs.map(i => permuted[i]);
    distinctOk = vals.length === 9 && new Set(vals).size === 9;
  }

  // 3. Permutation consistency for green cells
  let consistOk = true;
  for (const gi of greenIdxs) {
    const pd = PRESET[gi];
    const matching = orangeIdxs.find(ci => PRESET[ci] === pd);
    if (matching !== undefined && permuted[gi] !== permuted[matching]) {
      consistOk = false; break;
    }
  }

  const allOk = hashOk && distinctOk && consistOk;
  rounds++;
  phase = 'verified';
  renderGrid();
  updatePhaseBar();

  // Build check list
  const checks = [
    { ok: hashOk,    label: `Hash verification — all ${allRevealed.length} match` },
    ...(challengeType !== 'preset'
      ? [{ ok: distinctOk, label: 'Distinct digits — all 9 present, no duplicates' }]
      : []),
    ...(greenIdxs.length > 0
      ? [{ ok: consistOk, label: 'Permutation consistency — preset digits agree' }]
      : [])
  ];
  const checksEl = document.getElementById('verifyChecks');
  checksEl.innerHTML = checks.map(ch =>
    `<div class="verify-check ${ch.ok ? 'check-ok' : 'check-fail'}">
       <span class="check-icon">${ch.ok ? '✓' : '✗'}</span>
       <span>${ch.label}</span>
     </div>`
  ).join('');

  // Confidence
  const conf   = (1 - Math.pow(26 / 27, rounds)) * 100;
  const confStr = conf >= 99.99 ? '>99.99' : conf.toFixed(2);
  document.getElementById('statRounds').textContent = rounds;
  document.getElementById('statConf').textContent   = confStr + '%';
  document.getElementById('confBar').style.width    = Math.min(conf, 100).toFixed(2) + '%';

  showPanel('panelVerified');

  if (allOk) {
    setMsg(`Round ${rounds} passed. After ${rounds} round${rounds > 1 ? 's' : ''}, Victor's confidence is <strong>${confStr}%</strong>.`);
    setBtn('Next Round →');
  } else {
    setMsg('<strong style="color:#c44444;">Verification failed — Peggy appears to be cheating!</strong>');
    setBtn('Reset');
  }
}

// ── Phase: Next round ──────────────────────────────────
async function doNextRound() {
  perm = nonces = hashes = permuted = null;
  orangeIdxs = []; greenIdxs = [];
  await doCommit();
}

// ── Reset ──────────────────────────────────────────────
function resetDemo() {
  phase = 'setup';
  perm = nonces = hashes = permuted = null;
  orangeIdxs = []; greenIdxs = [];
  rounds = 0;

  document.getElementById('statRounds').textContent = '0';
  document.getElementById('statConf').textContent   = '—';
  document.getElementById('confBar').style.width    = '0%';

  renderGrid();
  showPanel('panelSetup');
  updatePhaseBar();
  setMsg('Click <strong>Begin Protocol</strong> to start a round.');
  setBtn('Begin Protocol');
  showReset(false);
}

// ── Utility ────────────────────────────────────────────
function tick() { return new Promise(r => setTimeout(r, 40)); }

// ── Init ───────────────────────────────────────────────
buildGrid();
renderGrid();
updatePhaseBar();
initChallengeControls();
