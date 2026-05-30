(function () {
  // ── Graph data ────────────────────────────────────────────────
  // Valid 3-coloring: 0→red(0), 1→blue(1), 2→green(2), 3→red(0), 4→blue(1)
  // Every edge connects nodes of different base colors ✓
  const NODES = [
    { id: 0, x: 190, y: 48,  base: 0 },
    { id: 1, x: 68,  y: 148, base: 1 },
    { id: 2, x: 312, y: 148, base: 2 },
    { id: 3, x: 108, y: 268, base: 0 },
    { id: 4, x: 272, y: 268, base: 1 },
  ];
  const EDGES = [[0,1],[0,2],[1,2],[1,3],[2,4],[3,4]];
  const M = EDGES.length; // 6

  const COLORS      = ['#c44444', '#4f86c0', '#4fa870'];
  const COLOR_NAMES = ['red', 'blue', 'green'];
  const R = 22;

  let phase     = 'setup';   // 'setup' | 'committed' | 'revealed'
  let perm      = [0, 1, 2];
  let challenge = null;
  let rounds    = 0;

  // ── DOM ───────────────────────────────────────────────────────
  const svgEl        = document.getElementById('demoSVG');
  if (!svgEl) return;
  const edgesG       = document.getElementById('demoEdges');
  const nodesG       = document.getElementById('demoNodes');
  const msgEl        = document.getElementById('demoMsg');
  const btnEl        = document.getElementById('demoBtn');
  const resetEl      = document.getElementById('demoReset');
  const statRoundsEl = document.getElementById('statRounds');
  const statConfEl   = document.getElementById('statConf');
  const pips         = [0,1,2].map(i => document.getElementById('pip'+i));

  // ── Helpers ───────────────────────────────────────────────────
  function ns(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }
  function randPerm() {
    const p = [0,1,2];
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
  }
  function pc(node) { return perm[node.base]; }

  function updateStats() {
    if (statRoundsEl) statRoundsEl.textContent = rounds;
    if (statConfEl) {
      if (rounds === 0) {
        statConfEl.textContent = '—';
      } else {
        const conf = (1 - Math.pow((M-1)/M, rounds)) * 100;
        statConfEl.textContent = conf.toFixed(2) + '%';
      }
    }
  }

  function msg(html) { if (msgEl) msgEl.innerHTML = html; }

  function setPips() {
    const idx = { setup: 0, committed: 1, revealed: 2 };
    pips.forEach((p, i) => {
      if (!p) return;
      p.classList.toggle('active', i === idx[phase]);
      p.classList.toggle('done',   i <  idx[phase]);
    });
  }

  // ── Draw edges ────────────────────────────────────────────────
  function drawEdges() {
    edgesG.innerHTML = '';
    EDGES.forEach(([a, b]) => {
      const isChallenge = challenge &&
        ((challenge[0]===a && challenge[1]===b) ||
         (challenge[0]===b && challenge[1]===a));

      const g    = ns('g');
      const line = ns('line');
      const hit  = ns('line'); // invisible wide hit area

      [line, hit].forEach(l => {
        l.setAttribute('x1', NODES[a].x);
        l.setAttribute('y1', NODES[a].y);
        l.setAttribute('x2', NODES[b].x);
        l.setAttribute('y2', NODES[b].y);
        l.setAttribute('stroke-linecap', 'round');
      });

      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '20');

      if (isChallenge && phase === 'revealed') {
        line.setAttribute('stroke', 'rgba(255,255,255,0.5)');
        line.setAttribute('stroke-width', '2');
      } else {
        line.setAttribute('stroke', '#2a2a3c');
        line.setAttribute('stroke-width', '1.8');
      }

      g.appendChild(line);
      g.appendChild(hit);

      // Clickable in committed phase
      if (phase === 'committed') {
        g.style.cursor = 'pointer';
        g.addEventListener('mouseenter', () => {
          line.setAttribute('stroke', 'rgba(236,236,244,0.4)');
          line.setAttribute('stroke-width', '2.2');
        });
        g.addEventListener('mouseleave', () => {
          line.setAttribute('stroke', '#2a2a3c');
          line.setAttribute('stroke-width', '1.8');
        });
        g.addEventListener('click', () => onEdgeClick([a, b]));
      }

      edgesG.appendChild(g);
    });
  }

  // ── Draw nodes ────────────────────────────────────────────────
  function drawNode(node) {
    const isRevealed = phase === 'revealed' && challenge && challenge.includes(node.id);
    const showColor  = phase === 'setup' || isRevealed;
    const color      = phase === 'setup' ? COLORS[node.base] : COLORS[pc(node)];
    const g          = ns('g');

    const outer = ns('circle');
    outer.setAttribute('cx', node.x);
    outer.setAttribute('cy', node.y);
    outer.setAttribute('r', R);

    if (showColor) {
      outer.setAttribute('fill', color);
      outer.setAttribute('stroke', color);
      outer.setAttribute('stroke-width', '1.5');
      g.appendChild(outer);

      const label = ns('text');
      label.setAttribute('x', node.x);
      label.setAttribute('y', node.y + 4.5);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', '600');
      label.setAttribute('font-family', 'Georgia, serif');
      label.setAttribute('fill', '#fff');
      label.setAttribute('pointer-events', 'none');
      label.textContent = node.id + 1;
      g.appendChild(label);
    } else {
      outer.setAttribute('fill', '#13131c');
      outer.setAttribute('stroke', phase === 'committed' ? '#2a2a3e' : '#252535');
      outer.setAttribute('stroke-width', '1.5');
      const body = ns('rect');
      body.setAttribute('x', node.x - 6.5);
      body.setAttribute('y', node.y - 3.5);
      body.setAttribute('width', '13');
      body.setAttribute('height', '9');
      body.setAttribute('rx', '2');
      body.setAttribute('fill', '#2c2c3e');
      const shackle = ns('path');
      shackle.setAttribute('d', `M ${node.x-3.5} ${node.y-3.5} a 3.5 3.5 0 0 1 7 0`);
      shackle.setAttribute('fill', 'none');
      shackle.setAttribute('stroke', '#2c2c3e');
      shackle.setAttribute('stroke-width', '2.2');
      shackle.setAttribute('stroke-linecap', 'round');
      g.appendChild(outer);
      g.appendChild(body);
      g.appendChild(shackle);
    }
    nodesG.appendChild(g);
  }

  function render() {
    nodesG.innerHTML = '';
    drawEdges();
    NODES.forEach(drawNode);
    setPips();
  }

  // ── Interactions ──────────────────────────────────────────────
  function onEdgeClick(edge) {
    challenge = edge;
    phase     = 'revealed';
    rounds++;

    const [a, b] = edge;
    const ca = pc(NODES[a]);
    const cb = pc(NODES[b]);
    msg(
      `Nodes <strong>${a+1}</strong> &amp; <strong>${b+1}</strong> revealed — ` +
      `<strong style="color:${COLORS[ca]}">${COLOR_NAMES[ca]}</strong> and ` +
      `<strong style="color:${COLORS[cb]}">${COLOR_NAMES[cb]}</strong>. ` +
      `<span style="color:#4fa870">✓ Different colors — edge is valid.</span>`
    );
    updateStats();
    btnEl.textContent  = 'Next Round';
    btnEl.style.display = '';
    resetEl.style.display = '';
    render();
  }

  btnEl.addEventListener('click', () => {
    if (phase === 'setup') {
      perm      = randPerm();
      challenge = null;
      phase     = 'committed';
      msg('Colors shuffled and <strong>committed</strong> — all nodes are locked. <strong>Click any edge</strong> in the graph to challenge it as the verifier.');
      btnEl.style.display   = 'none';
      resetEl.style.display = rounds > 0 ? '' : 'none';
      render();
    } else if (phase === 'revealed') {
      perm      = randPerm();
      challenge = null;
      phase     = 'committed';
      msg('New permutation committed. <strong>Click any edge</strong> to challenge it.');
      btnEl.style.display   = 'none';
      resetEl.style.display = '';
      render();
    }
  });

  resetEl.addEventListener('click', () => {
    phase     = 'setup';
    challenge = null;
    perm      = [0, 1, 2];
    rounds    = 0;
    btnEl.textContent     = 'Commit';
    btnEl.style.display   = '';
    resetEl.style.display = 'none';
    updateStats();
    msg("This is Bob's valid <strong>3-coloring</strong> — every adjacent pair has different colors. Press <strong>Commit</strong> to start the proof.");
    render();
  });

  // ── Init ──────────────────────────────────────────────────────
  resetEl.style.display = 'none';
  updateStats();
  msg("This is Bob's valid <strong>3-coloring</strong> — every adjacent pair has different colors. Press <strong>Commit</strong> to start the proof.");
  render();
})();
