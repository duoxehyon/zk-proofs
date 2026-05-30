// ─────────────────────────────────────────────────────────
// Ali Baba Cave — Interactive Demo
// ─────────────────────────────────────────────────────────

// ── SVG element refs ───────────────────────────────────
const peggyG      = document.getElementById('peggyG');
const peggyLabel  = document.getElementById('peggyLabel');
const peggyCircle = document.getElementById('peggyCircle');
const hlA         = document.getElementById('hlA');
const hlB         = document.getElementById('hlB');
const doorGlowEl  = document.getElementById('doorGlowEl');
const callBubble  = document.getElementById('callBubble');
const callText    = document.getElementById('callText');
const labelA      = document.getElementById('labelA');
const labelB      = document.getElementById('labelB');

// ── Peggy positions (match new SVG viewBox 300×268) ───
// Outer: bottom=216, Inner top=48, corridor midpoint at x≈64/236
const POS = {
  outside : { x: 150, y: 233 },  // just below entrance
  center  : { x: 150, y: 117 },  // hidden inside (shows "?")
  pathA   : { x:  62, y: 117 },  // left corridor midpoint
  pathB   : { x: 238, y: 117 },  // right corridor midpoint
  door    : { x: 150, y:  50 },  // at the magic door
};

// ── State ──────────────────────────────────────────────
const PHASES = ['idle', 'inside', 'called', 'exited'];
let phase       = 'idle';
let peggyChoice = null;   // 'A' | 'B'
let victorCall  = null;   // 'A' | 'B'
let usedDoor    = false;
let rounds      = 0;

// ── Move Peggy ─────────────────────────────────────────
function movePeggy(key, instant = false) {
  const { x, y } = POS[key];
  if (instant) {
    peggyG.style.transition = 'none';
    peggyG.getBoundingClientRect(); // force reflow
  } else {
    // Spring-bounce easing — matches the CSS declaration
    peggyG.style.transition = 'transform 0.75s cubic-bezier(0.34, 1.4, 0.64, 1)';
  }
  peggyG.style.transform = `translate(${x}px, ${y}px)`;
}

function setPeggyLabel(txt, accent = false) {
  peggyLabel.textContent = txt;
  peggyLabel.style.fill = accent ? '#818cf8' : '#ececf4';
}

function setPeggyGlow(on) {
  peggyCircle.style.stroke      = on ? '#ececf4' : '#818cf8';
  peggyCircle.style.strokeWidth = on ? '2.8'     : '2';
}

// ── Path highlights ────────────────────────────────────
function setHighlight(path) {
  hlA.style.opacity = (path === 'A') ? '1' : '0';
  hlB.style.opacity = (path === 'B') ? '1' : '0';
  labelA.style.fill = (path === 'A') ? '#818cf8' : '#2c2c48';
  labelB.style.fill = (path === 'B') ? '#818cf8' : '#2c2c48';
}

function clearHighlight() {
  hlA.style.opacity = '0';
  hlB.style.opacity = '0';
  labelA.style.fill = '#2c2c48';
  labelB.style.fill = '#2c2c48';
}

// ── Door glow + pulse ──────────────────────────────────
function setDoorGlow(on) {
  if (on) {
    doorGlowEl.style.opacity = '1';
    doorGlowEl.classList.add('door-pulsing');
  } else {
    doorGlowEl.style.opacity = '0';
    doorGlowEl.classList.remove('door-pulsing');
  }
}

// ── Call bubble ────────────────────────────────────────
function showCallBubble(side) {
  callText.textContent = `Path ${side}!`;
  callBubble.style.opacity = '1';
}

function hideCallBubble() {
  callBubble.style.opacity = '0';
}

// ── Phase bar ──────────────────────────────────────────
function updatePhaseBar() {
  const idx = PHASES.indexOf(phase);
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`ps${i}`);
    el.classList.remove('current', 'done');
    if (i < idx)  el.classList.add('done');
    if (i === idx) el.classList.add('current');
  }
}

// ── Panel switcher ─────────────────────────────────────
function showPanel(id) {
  ['panelIdle','panelInside','panelCalled','panelExited'].forEach(p => {
    document.getElementById(p).style.display = (p === id) ? '' : 'none';
  });
}

// ── UI helpers ─────────────────────────────────────────
function setMsg(html) { document.getElementById('demoMsg').innerHTML = html; }
function setBtn(t, off) { const b = document.getElementById('actionBtn'); b.textContent = t; b.disabled = !!off; }
function showReset(v) { document.getElementById('resetBtn').style.display = v ? '' : 'none'; }

function tick(ms = 40) { return new Promise(r => setTimeout(r, ms)); }

// ── Confidence ─────────────────────────────────────────
function updateConfidence() {
  if (rounds === 0) {
    document.getElementById('statConf').textContent = '—';
    document.getElementById('confBar').style.width = '0%';
    return;
  }
  const conf    = (1 - Math.pow(0.5, rounds)) * 100;
  const confStr = conf >= 99.99 ? '>99.99' : conf.toFixed(2);
  document.getElementById('statConf').textContent   = confStr + '%';
  document.getElementById('confBar').style.width    = Math.min(conf, 100).toFixed(2) + '%';
}

// ── Main action handler ────────────────────────────────
async function handleAction() {
  if (phase === 'idle')   await doPeggyEnters();
  else if (phase === 'inside')  doVictorCalls();
  else if (phase === 'called')  await doPeggyExits();
  else if (phase === 'exited')  await doNextRound();
}

// ── Phase: Peggy enters ────────────────────────────────
async function doPeggyEnters() {
  phase = 'inside';
  peggyChoice = Math.random() < 0.5 ? 'A' : 'B';

  // Animate Peggy into the cave (to center as "?")
  setPeggyLabel('?');
  movePeggy('center');

  showPanel('panelInside');
  updatePhaseBar();
  showReset(true);

  await tick(200);

  // Reveal which path (to reader only)
  document.getElementById('choiceValue').textContent = `Path ${peggyChoice}`;
  document.getElementById('choiceBox').style.borderColor = peggyChoice === 'A' ? '#4fa870' : '#818cf8';

  setMsg(`Peggy has secretly entered <strong>Path ${peggyChoice}</strong>. Victor waits outside and cannot see her.`);
  setBtn('Victor Calls →');
}

// ── Phase: Victor calls ────────────────────────────────
function doVictorCalls() {
  phase = 'called';
  victorCall = Math.random() < 0.5 ? 'A' : 'B';
  usedDoor   = (peggyChoice !== victorCall);

  // Show Victor's call bubble
  showCallBubble(victorCall);

  // Reveal Peggy's actual position
  setPeggyLabel('P');
  movePeggy(peggyChoice === 'A' ? 'pathA' : 'pathB');

  // Highlight the called path
  setHighlight(victorCall);

  // Populate called panel
  document.getElementById('peggyBoxVal').textContent = `Path ${peggyChoice}`;
  document.getElementById('victorBoxVal').textContent = `Path ${victorCall}`;

  const peggyBoxEl  = document.getElementById('peggyBox');
  const victorBoxEl = document.getElementById('victorBox');
  peggyBoxEl.className  = 'choice-box ' + (usedDoor ? 'mismatch' : 'match');
  victorBoxEl.className = 'choice-box ' + (usedDoor ? 'mismatch' : 'match');

  document.getElementById('doorNote').innerHTML = usedDoor
    ? `Peggy is on Path <strong>${peggyChoice}</strong> but Victor called Path <strong>${victorCall}</strong>. She must <em>use the magic door</em> to cross and exit from the correct side.`
    : `Peggy is on Path <strong>${peggyChoice}</strong> and Victor called Path <strong>${peggyChoice}</strong>. She can exit directly — no door needed.`;

  showPanel('panelCalled');
  updatePhaseBar();

  const situation = usedDoor
    ? `Victor called <strong>Path ${victorCall}</strong> — Peggy is on the wrong side! She'll use the magic door.`
    : `Victor called <strong>Path ${victorCall}</strong> — Peggy is already there. She exits directly.`;
  setMsg(situation);
  setBtn('Peggy Exits →');
}

// ── Phase: Peggy exits ─────────────────────────────────
async function doPeggyExits() {
  phase = 'exited';
  updatePhaseBar();
  setBtn('…', true);

  if (usedDoor) {
    // Animate: current path → door → called path → exit
    movePeggy('door');
    setDoorGlow(true);
    await tick(750);
    setDoorGlow(false);
    movePeggy(victorCall === 'A' ? 'pathA' : 'pathB');
    await tick(750);
  }

  // Exit to entrance
  movePeggy('outside');
  await tick(750);

  hideCallBubble();
  clearHighlight();
  setPeggyGlow(true);
  setPeggyLabel('✓');
  await tick(300);

  rounds++;
  document.getElementById('statRounds').textContent = rounds;
  updateConfidence();

  const conf    = (1 - Math.pow(0.5, rounds)) * 100;
  const confStr = conf >= 99.99 ? '>99.99' : conf.toFixed(2);

  // Populate result panel
  const via = usedDoor ? 'Used the magic door to cross' : 'Walked out directly (no door needed)';
  document.getElementById('resultRow').className = 'verify-row v-ok';
  document.getElementById('resultText').innerHTML =
    `Peggy emerged from Path <strong>${victorCall}</strong> — round passed. <em>${via}.</em>`;

  showPanel('panelExited');
  setMsg(`Round ${rounds} complete. Confidence Victor is convinced: <strong>${confStr}%</strong>.`);
  setBtn('Next Round →');

  await tick(500);
  setPeggyGlow(false);
  setPeggyLabel('P');
}

// ── Phase: Next round ──────────────────────────────────
async function doNextRound() {
  peggyChoice = null;
  victorCall  = null;
  usedDoor    = false;

  // Reset visuals
  setPeggyLabel('P');
  movePeggy('outside', true);
  clearHighlight();
  hideCallBubble();
  setDoorGlow(false);

  showPanel('panelIdle');
  phase = 'idle';
  updatePhaseBar();

  await tick(100);
  await doPeggyEnters();
}

// ── Reset ──────────────────────────────────────────────
function resetDemo() {
  phase = 'idle';
  peggyChoice = null; victorCall = null; usedDoor = false;
  rounds = 0;

  document.getElementById('statRounds').textContent = '0';
  document.getElementById('statConf').textContent   = '—';
  document.getElementById('confBar').style.width    = '0%';

  movePeggy('outside', true);
  clearHighlight();
  hideCallBubble();
  setDoorGlow(false);
  setPeggyLabel('P');
  setPeggyGlow(false);
  peggyCircle.style.stroke = '#818cf8';
  peggyCircle.style.strokeWidth = '2';

  showPanel('panelIdle');
  updatePhaseBar();
  setMsg('Click <strong>Begin Round</strong> to start.');
  setBtn('Begin Round');
  showReset(false);
}

// ── Init ───────────────────────────────────────────────
movePeggy('outside', true);
updatePhaseBar();
clearHighlight();
