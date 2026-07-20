'use strict';

(function () {

  // ═══════════════════════════════════════════════════════════
  //  STYLES
  // ═══════════════════════════════════════════════════════════
  const ARCADE_CSS = `
  @keyframes arc-glow {
    0%,100% { text-shadow: 0 0 8px #00d4ff, 0 0 20px #00d4ff; }
    50%      { text-shadow: 0 0 16px #00d4ff, 0 0 40px #00d4ff, 0 0 60px #0088ff; }
  }
  @keyframes arc-scanline {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }

  #arc-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,4,12,.88);
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(6px);
  }
  #arc-box {
    background: #06080f;
    border: 2px solid #00d4ff;
    border-radius: 14px;
    box-shadow: 0 0 50px rgba(0,212,255,.25), inset 0 0 30px rgba(0,0,0,.6);
    width: min(94vw, 760px);
    max-height: 90vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    position: relative;
  }
  #arc-header {
    background: linear-gradient(90deg, #000d1a, #001a30, #000d1a);
    border-bottom: 2px solid #00d4ff22;
    padding: 12px 20px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  #arc-title {
    color: #00d4ff;
    font-size: 20px; font-weight: 900; letter-spacing: 5px;
    animation: arc-glow 2.5s ease-in-out infinite;
  }
  #arc-close {
    background: none; border: 1.5px solid #ff4466; color: #ff4466;
    width: 26px; height: 26px; border-radius: 50%; cursor: pointer;
    font-size: 13px; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
    transition: all .15s; line-height: 1;
  }
  #arc-close:hover { background: #ff4466; color: #fff; box-shadow: 0 0 10px #ff4466; }

  #arc-body {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    padding: 18px 20px;
  }
  #arc-body::-webkit-scrollbar { width: 5px; }
  #arc-body::-webkit-scrollbar-track { background: #06080f; }
  #arc-body::-webkit-scrollbar-thumb { background: #1a4060; border-radius: 3px; }

  /* ── Menu ── */
  #arc-menu { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
  .arc-card {
    background: #0c1220; border: 1.5px solid #182840;
    border-radius: 10px; padding: 16px 10px;
    cursor: pointer; text-align: center;
    transition: all .18s; user-select: none;
  }
  .arc-card:hover {
    border-color: #00d4ff;
    box-shadow: 0 0 18px rgba(0,212,255,.2);
    transform: translateY(-3px);
    background: #0e1828;
  }
  .arc-card-icon  { font-size: 30px; line-height: 1.1; margin-bottom: 7px; }
  .arc-card-name  { color: #00d4ff; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; }
  .arc-card-players { color: #3a6080; font-size: 10px; margin-top: 4px; }

  /* ── Jeu ── */
  #arc-game { display: none; flex-direction: column; align-items: center; gap: 12px; }
  #arc-game.active { display: flex; }
  #arc-game-title  { color: #00d4ff; font-size: 14px; font-weight: 700; letter-spacing: 2.5px; }
  #arc-game-status { color: #ffd700; font-size: 12px; min-height: 18px; text-align: center; }

  .arc-btn-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 4px; }
  .arc-btn {
    background: #0c1220; border: 1.5px solid #00d4ff; color: #00d4ff;
    padding: 6px 14px; border-radius: 6px; cursor: pointer;
    font-family: 'Courier New', monospace; font-size: 11px; font-weight: 700;
    letter-spacing: 1px; transition: all .15s;
  }
  .arc-btn:hover { background: #00d4ff; color: #000; box-shadow: 0 0 10px rgba(0,212,255,.4); }

  /* ── Plateaux ── */
  .arc-board {
    display: inline-grid; gap: 2px;
    background: #0a1828; padding: 4px; border-radius: 6px;
    border: 1.5px solid #182840;
  }
  .arc-cell {
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; user-select: none; transition: filter .1s;
  }
  .arc-cell:hover { filter: brightness(1.2); }

  /* ── PIN Gate ── */
  #arc-pin-gate {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; padding: 28px 20px; min-height: 320px;
  }
  #arc-pin-title {
    color: #ff4466; font-size: 13px; font-weight: 900; letter-spacing: 4px; text-align: center;
  }
  #arc-pin-subtitle { color: #3a6080; font-size: 10px; letter-spacing: 1.5px; text-align: center; }
  #arc-pin-display { display: flex; gap: 16px; margin: 4px 0; }
  .arc-pin-dot {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid #00d4ff33; background: transparent; transition: background .15s;
  }
  .arc-pin-dot.filled { background: #00d4ff; border-color: #00d4ff; box-shadow: 0 0 8px #00d4ff77; }
  #arc-pin-pad { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; max-width: 210px; }
  .arc-pin-btn {
    background: #0c1220; border: 1.5px solid #1a3050; color: #00d4ff;
    width: 60px; height: 60px; border-radius: 10px; cursor: pointer;
    font-family: 'Courier New', monospace; font-size: 20px; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
    transition: all .12s; user-select: none; touch-action: manipulation;
  }
  .arc-pin-btn:hover { background: #162030; border-color: #00d4ff44; }
  .arc-pin-btn:active { background: #00d4ff22; transform: scale(.93); }
  .arc-pin-btn-clear { color: #ff4466; border-color: #ff446633; font-size: 11px; font-weight: 700; letter-spacing: .5px; }
  #arc-pin-error { color: #ff4466; font-size: 10px; letter-spacing: 1px; min-height: 14px; text-align: center; }

  /* footer hint */
  .site-footer-credit { cursor: pointer; transition: opacity .2s; }
  .site-footer-credit:hover { opacity: 0.7 !important; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = ARCADE_CSS;
  document.head.appendChild(styleEl);

  // ═══════════════════════════════════════════════════════════
  //  CATALOGUE
  // ═══════════════════════════════════════════════════════════
  const GAMES = [
    { id: 'morpion',  name: 'Morpion',       icon: '✕○',  players: '1 – 2 joueurs' },
    { id: 'p4',       name: 'Puissance 4',   icon: '🔴',  players: '2 joueurs'     },
    { id: 'dames',    name: 'Jeu de dames',  icon: '⚫',  players: '2 joueurs'     },
    { id: 'snake',    name: 'Snake',          icon: '🐍',  players: '1 joueur'      },
    { id: 'breakout', name: 'Casse-briques', icon: '🧱',  players: '1 joueur'      },
    { id: 'memory',   name: 'Memory',         icon: '🃏',  players: '1 – 4 joueurs' },
    { id: 'flappy',   name: 'Flappy Bird',   icon: '🐤',  players: '1 joueur'      },
    { id: 'pong',     name: 'Pong',           icon: '🏓',  players: '2 joueurs'     },
    { id: 'taquin',   name: 'Taquin',         icon: '🧩',  players: '1 joueur'      },
    { id: 'simon',    name: 'Simon',           icon: '🔮',  players: '1 – 4 joueurs' },
  ];

  // ═══════════════════════════════════════════════════════════
  //  MODAL
  // ═══════════════════════════════════════════════════════════
  let overlay, menuEl, gameEl, statusEl;
  let _currentGame = null, _cleanup = null;
  let _arcadeUnlocked = false;
  const PIN_CODE = '0717';

  function buildModal() {
    overlay = document.createElement('div');
    overlay.id = 'arc-overlay';
    overlay.innerHTML = `
      <div id="arc-box">
        <div id="arc-header">
          <div id="arc-title">★ ARCADE ★</div>
          <button id="arc-close">✕</button>
        </div>
        <div id="arc-body">
          <div id="arc-pin-gate" style="display:none">
            <div id="arc-pin-title">⚠ ACCÈS RESTREINT</div>
            <div id="arc-pin-subtitle">Entrez le code d'accès</div>
            <div id="arc-pin-display">
              <div class="arc-pin-dot" id="arc-pd-0"></div>
              <div class="arc-pin-dot" id="arc-pd-1"></div>
              <div class="arc-pin-dot" id="arc-pd-2"></div>
              <div class="arc-pin-dot" id="arc-pd-3"></div>
            </div>
            <div id="arc-pin-pad">
              <button class="arc-pin-btn" data-digit="1">1</button>
              <button class="arc-pin-btn" data-digit="2">2</button>
              <button class="arc-pin-btn" data-digit="3">3</button>
              <button class="arc-pin-btn" data-digit="4">4</button>
              <button class="arc-pin-btn" data-digit="5">5</button>
              <button class="arc-pin-btn" data-digit="6">6</button>
              <button class="arc-pin-btn" data-digit="7">7</button>
              <button class="arc-pin-btn" data-digit="8">8</button>
              <button class="arc-pin-btn" data-digit="9">9</button>
              <button class="arc-pin-btn arc-pin-btn-clear" data-action="clear">Eff.</button>
              <button class="arc-pin-btn" data-digit="0">0</button>
              <button class="arc-pin-btn arc-pin-btn-clear" data-action="back">←</button>
            </div>
            <div id="arc-pin-error"></div>
          </div>
          <div id="arc-menu"></div>
          <div id="arc-game">
            <div id="arc-game-title"></div>
            <div id="arc-game-status"></div>
            <div id="arc-game-area"></div>
            <div class="arc-btn-row">
              <button class="arc-btn" id="arc-restart">↺ Rejouer</button>
              <button class="arc-btn" id="arc-back">← Menu</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    menuEl   = overlay.querySelector('#arc-menu');
    gameEl   = overlay.querySelector('#arc-game');
    statusEl = overlay.querySelector('#arc-game-status');

    GAMES.forEach(g => {
      const card = document.createElement('div');
      card.className = 'arc-card';
      card.innerHTML = `<div class="arc-card-icon">${g.icon}</div>
        <div class="arc-card-name">${g.name}</div>
        <div class="arc-card-players">${g.players}</div>`;
      card.addEventListener('click', () => startGame(g.id));
      menuEl.appendChild(card);
    });

    overlay.querySelector('#arc-close').addEventListener('click', closeArcade);
    overlay.querySelector('#arc-back').addEventListener('click', showMenu);
    overlay.querySelector('#arc-restart').addEventListener('click', () => _currentGame && startGame(_currentGame));
    overlay.addEventListener('click', e => { if (e.target === overlay) closeArcade(); });
  }

  function openArcade() {
    if (!overlay) buildModal();
    overlay.style.display = 'flex';
    if (!_arcadeUnlocked) { showPinGate(); } else { showMenu(); }
  }
  function closeArcade() {
    stop(); overlay.style.display = 'none';
  }
  function stop() {
    if (_cleanup) { _cleanup(); _cleanup = null; }
  }
  function showPinGate() {
    stop();
    menuEl.style.display = 'none';
    gameEl.classList.remove('active');
    overlay.querySelector('#arc-title').style.visibility = 'hidden';
    var gate = overlay.querySelector('#arc-pin-gate');
    gate.style.display = 'flex';

    var entered = '';
    var dots = [0, 1, 2, 3].map(function(i) { return overlay.querySelector('#arc-pd-' + i); });
    var errorEl = overlay.querySelector('#arc-pin-error');

    function updateDots() {
      dots.forEach(function(d, i) { d.classList.toggle('filled', i < entered.length); });
    }
    function checkPin() {
      if (entered === PIN_CODE) {
        _arcadeUnlocked = true;
        gate.style.display = 'none';
        showMenu();
      } else {
        errorEl.textContent = '✕  Code incorrect';
        entered = '';
        updateDots();
        setTimeout(function() { errorEl.textContent = ''; }, 1500);
      }
    }

    var pad = overlay.querySelector('#arc-pin-pad');
    var newPad = pad.cloneNode(true);
    pad.parentNode.replaceChild(newPad, pad);
    newPad.addEventListener('click', function(e) {
      var btn = e.target.closest('.arc-pin-btn');
      if (!btn) return;
      var digit = btn.dataset.digit;
      var action = btn.dataset.action;
      if (action === 'clear') { entered = ''; updateDots(); errorEl.textContent = ''; }
      else if (action === 'back') { entered = entered.slice(0, -1); updateDots(); }
      else if (digit !== undefined && entered.length < 4) {
        entered += digit;
        updateDots();
        if (entered.length === 4) setTimeout(checkPin, 80);
      }
    });

    updateDots();
    errorEl.textContent = '';
  }

  function showMenu() {
    stop();
    overlay.querySelector('#arc-title').style.visibility = 'visible';
    menuEl.style.display = 'grid';
    gameEl.classList.remove('active');
    _currentGame = null;
  }
  function startGame(id) {
    stop();
    _currentGame = id;
    menuEl.style.display = 'none';
    gameEl.classList.add('active');
    const area = overlay.querySelector('#arc-game-area');
    area.innerHTML = '';
    statusEl.textContent = '';
    overlay.querySelector('#arc-game-title').textContent =
      (GAMES.find(g => g.id === id)?.name || '').toUpperCase();
    _cleanup = GameDefs[id](area, t => { statusEl.textContent = t; }) || null;
  }

  // ═══════════════════════════════════════════════════════════
  //  JEUX
  // ═══════════════════════════════════════════════════════════
  const GameDefs = {};

  // ── MORPION ─────────────────────────────────────────────────
  GameDefs.morpion = function (container, setStatus) {
    const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let board = Array(9).fill(null), turn = 'X', over = false;

    const grid = document.createElement('div');
    grid.className = 'arc-board';
    grid.style.gridTemplateColumns = 'repeat(3,1fr)';
    grid.style.background = '#f0f4f8';
    grid.style.borderColor = '#c0ccd8';
    container.appendChild(grid);

    const cells = Array.from({ length: 9 }, (_, i) => {
      const c = document.createElement('div');
      c.className = 'arc-cell';
      c.style.cssText = 'width:72px;height:72px;font-size:32px;font-weight:900;background:#ffffff;border:2px solid #c0ccd8;border-radius:6px;';
      c.addEventListener('click', () => play(i));
      grid.appendChild(c);
      return c;
    });

    function checkWin(p) { return WINS.some(([a,b,c]) => board[a]===p && board[b]===p && board[c]===p); }
    function render() {
      cells.forEach((c, i) => {
        c.textContent = board[i] || '';
        c.style.color = board[i] === 'X' ? '#1565c0' : '#c62828';
      });
    }
    function play(i) {
      if (over || board[i]) return;
      board[i] = turn;
      render();
      if (checkWin(turn)) { setStatus(`🏆 Joueur ${turn} gagne !`); over = true; return; }
      if (board.every(Boolean)) { setStatus('Match nul !'); over = true; return; }
      turn = turn === 'X' ? 'O' : 'X';
      setStatus(`Tour de ${turn}`);
    }

    setStatus(`Tour de X`);
    render();
  };

  // ── PUISSANCE 4 ─────────────────────────────────────────────
  GameDefs.p4 = function (container, setStatus) {
    const COLS = 7, ROWS = 6;
    let board = Array.from({ length: COLS }, () => Array(ROWS).fill(0));
    let turn = 1, over = false;

    const grid = document.createElement('div');
    grid.className = 'arc-board';
    grid.style.cssText = `grid-template-columns:repeat(${COLS},1fr);background:#ffffff;padding:6px;gap:4px;border:2px solid #ddd;`;
    container.appendChild(grid);

    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const el = document.createElement('div');
        el.className = 'arc-cell';
        el.style.cssText = 'width:44px;height:44px;border-radius:50%;background:#c8def0;border:2px solid #7ab0d8;';
        el.addEventListener('click', () => drop(c));
        grid.appendChild(el);
        cells.push({ r, c, el });
      }
    }

    function drop(col) {
      if (over) return;
      let row = -1;
      for (let r = ROWS - 1; r >= 0; r--) { if (!board[col][r]) { row = r; break; } }
      if (row === -1) return;
      board[col][row] = turn;
      render();
      if (checkWin()) { setStatus(`🏆 Joueur ${turn === 1 ? '🔴' : '🟡'} gagne !`); over = true; return; }
      if (board.every(col => col.every(Boolean))) { setStatus('Match nul !'); over = true; return; }
      turn = turn === 1 ? 2 : 1;
      setStatus(`Tour joueur ${turn === 1 ? '🔴' : '🟡'}`);
    }
    function render() {
      cells.forEach(({ r, c, el }) => {
        const v = board[c][r];
        el.style.background = v === 1 ? '#e53935' : v === 2 ? '#ffd600' : '#c8def0';
        el.style.boxShadow  = v === 1 ? '0 0 8px #e53935' : v === 2 ? '0 0 8px #ffd600' : 'none';
      });
    }
    function checkWin() {
      const dirs = [[1,0],[0,1],[1,1],[1,-1]];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
        if (!board[c][r]) continue;
        const p = board[c][r];
        for (const [dc,dr] of dirs) {
          let n = 1;
          for (let k = 1; k < 4; k++) {
            const nc = c+dc*k, nr = r+dr*k;
            if (nc<0||nc>=COLS||nr<0||nr>=ROWS||board[nc][nr]!==p) break;
            n++;
          }
          if (n >= 4) return true;
        }
      }
      return false;
    }
    setStatus('Tour joueur 🔴');
    render();
  };

  // ── JEU DE DAMES ────────────────────────────────────────────
  GameDefs.dames = function (container, setStatus) {
    let board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 8; c++)
        if ((r+c)%2===1) board[r][c] = { p:1, king:false };
    for (let r = 5; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if ((r+c)%2===1) board[r][c] = { p:2, king:false };

    let turn = 1, selected = null, legalMoves = [], over = false;

    const gridEl = document.createElement('div');
    gridEl.className = 'arc-board';
    gridEl.style.cssText = 'grid-template-columns:repeat(8,1fr);gap:1px;background:#0a1218;padding:3px;';
    container.appendChild(gridEl);

    const cells = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const el = document.createElement('div');
      el.className = 'arc-cell';
      el.style.cssText = `width:38px;height:38px;border-radius:2px;position:relative;`;
      el.addEventListener('click', () => onClick(r, c));
      gridEl.appendChild(el);
      cells.push({ r, c, el });
    }

    function getMoves(r, c, b, forceCap) {
      const pc = b[r][c]; if (!pc) return [];
      const dirs = pc.king ? [[-1,-1],[-1,1],[1,-1],[1,1]]
                           : pc.p===1 ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
      const caps = [], simples = [];
      for (const [dr,dc] of dirs) {
        const nr=r+dr, nc=c+dc;
        if (nr<0||nr>7||nc<0||nc>7) continue;
        if (!b[nr][nc]) { simples.push({from:[r,c],to:[nr,nc],cap:null}); }
        else if (b[nr][nc].p !== pc.p) {
          const jr=nr+dr, jc=nc+dc;
          if (jr>=0&&jr<=7&&jc>=0&&jc<=7&&!b[jr][jc])
            caps.push({from:[r,c],to:[jr,jc],cap:[nr,nc]});
        }
      }
      return (caps.length>0||forceCap) ? caps : simples;
    }
    function allCaps(p, b) {
      const res = [];
      for (let r=0;r<8;r++) for (let c=0;c<8;c++)
        if (b[r][c]?.p===p) res.push(...getMoves(r,c,b,true).filter(m=>m.cap));
      return res;
    }

    function onClick(r, c) {
      if (over) return;
      const mustCap = allCaps(turn, board).length > 0;
      if (!selected) {
        if (board[r][c]?.p !== turn) return;
        const m = getMoves(r, c, board, mustCap);
        if (!m.length) return;
        selected = [r,c]; legalMoves = m; render();
      } else {
        const mv = legalMoves.find(m => m.to[0]===r && m.to[1]===c);
        if (mv) { applyMove(mv); }
        else { selected=null; legalMoves=[]; onClick(r,c); }
      }
    }
    function applyMove(mv) {
      const [fr,fc]=[...mv.from], [tr,tc]=[...mv.to];
      const pc = {...board[fr][fc]};
      board[fr][fc] = null;
      if (mv.cap) board[mv.cap[0]][mv.cap[1]] = null;
      if (tr===7&&pc.p===1) pc.king=true;
      if (tr===0&&pc.p===2) pc.king=true;
      board[tr][tc] = pc;
      if (mv.cap) {
        const chain = getMoves(tr,tc,board,true).filter(m=>m.cap);
        if (chain.length) { selected=[tr,tc]; legalMoves=chain; render(); return; }
      }
      selected=null; legalMoves=[];
      turn = turn===1 ? 2 : 1;
      checkOver(); render();
    }
    function checkOver() {
      const p1 = board.flat().filter(x=>x?.p===1).length;
      const p2 = board.flat().filter(x=>x?.p===2).length;
      if (!p1) { setStatus('🏆 Joueur 2 (⚪) gagne !'); over=true; return; }
      if (!p2) { setStatus('🏆 Joueur 1 (⚫) gagne !'); over=true; return; }
      const hasMoves = board.some((row,r) => row.some((pc,c) => pc?.p===turn && getMoves(r,c,board,false).length>0));
      if (!hasMoves) { setStatus(`Joueur ${turn===1?'2 (⚪)':'1 (⚫)'} gagne — blocage !`); over=true; }
    }
    function render() {
      const dests = legalMoves.map(m => m.to.join(','));
      cells.forEach(({r,c,el}) => {
        const light = (r+c)%2===0;
        let bg = light ? '#c8a870' : '#6b3a1a';
        if (selected && selected[0]===r && selected[1]===c) bg = '#00aaff55';
        if (dests.includes(`${r},${c}`)) bg = '#ffd70044';
        el.style.background = bg;
        el.innerHTML = '';
        const pc = board[r][c];
        if (pc) {
          const disc = document.createElement('div');
          disc.style.cssText = `
            width:28px;height:28px;border-radius:50%;
            background:${pc.p===1?'#111':'#f0f0f0'};
            border:3px solid ${pc.p===1?'#555':'#aaa'};
            box-shadow:${pc.p===1?'inset 0 -2px 4px rgba(255,255,255,.1)':'inset 0 -2px 4px rgba(0,0,0,.15)'};
            display:flex;align-items:center;justify-content:center;
            font-size:13px;color:${pc.p===1?'#ffd700':'#333'};
          `;
          if (pc.king) disc.textContent = '★';
          el.appendChild(disc);
        }
      });
      if (!over) setStatus(`Tour joueur ${turn===1?'⚫ 1':'⚪ 2'}`);
    }
    render();
  };

  // ── SNAKE ────────────────────────────────────────────────────
  GameDefs.snake = function (container, setStatus) {
    const COLS=22, ROWS=16, SZ=20;
    const canvas = document.createElement('canvas');
    canvas.width = COLS*SZ; canvas.height = ROWS*SZ;
    canvas.style.cssText = 'border:2px solid #00d4ff33;border-radius:6px;display:block;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const PULIST = [
      { type:'speed',  icon:'⚡', color:'#ffdd00', label:'BOOST !',       dur:5000 },
      { type:'slow',   icon:'❄',  color:'#44ddff', label:'SLOW !',        dur:6000 },
      { type:'shrink', icon:'💊', color:'#ff88ff', label:'RÉDUCTION !',   dur:0    },
      { type:'x2',     icon:'×2', color:'#ff8800', label:'DOUBLE SCORE !',dur:8000 },
      { type:'ghost',  icon:'👻', color:'#aaaaff', label:'FANTÔME !',     dur:5000 },
    ];

    let snake, dir, nextDir, food, score, alive, raf, last;
    let groundPU = null;      // power-up visible sur le terrain
    let activeEff = null;     // { type, endsAt, totalDur }
    let stepMs = 130;
    let foodCount = 0;

    function rndPos(avoid=[]) {
      let p;
      do { p={x:Math.floor(Math.random()*COLS), y:Math.floor(Math.random()*ROWS)}; }
      while (snake.some(s=>s.x===p.x&&s.y===p.y) || avoid.some(a=>a&&a.x===p.x&&a.y===p.y));
      return p;
    }
    function init() {
      snake=[{x:11,y:8},{x:10,y:8},{x:9,y:8}];
      dir={x:1,y:0}; nextDir={x:1,y:0};
      food=rndPos(); score=0; alive=true; last=0;
      groundPU=null; activeEff=null; stepMs=130; foodCount=0;
      setStatus('Vire à gauche ou à droite !');
    }
    function spawnPU() {
      if (groundPU) return;
      const def = PULIST[Math.floor(Math.random()*PULIST.length)];
      groundPU = { ...rndPos([food]), ...def, expires: Date.now()+9000 };
    }
    function applyEff(def) {
      activeEff=null; stepMs=130;
      if (def.type==='speed')  { stepMs=60;  activeEff={...def, endsAt:Date.now()+def.dur}; }
      if (def.type==='slow')   { stepMs=250; activeEff={...def, endsAt:Date.now()+def.dur}; }
      if (def.type==='x2')     {             activeEff={...def, endsAt:Date.now()+def.dur}; }
      if (def.type==='ghost')  {             activeEff={...def, endsAt:Date.now()+def.dur}; }
      if (def.type==='shrink') {
        snake.splice(Math.max(1, snake.length-4));
        setTimeout(()=>{ if(alive) setStatus(`Score : ${score}`); }, 1500);
      }
      setStatus(def.label);
    }
    function step() {
      if (activeEff && Date.now()>activeEff.endsAt) {
        activeEff=null; stepMs=130;
        if(alive) setStatus(`Score : ${score}`);
      }
      if (groundPU && Date.now()>groundPU.expires) groundPU=null;

      dir=nextDir;
      const h={x:snake[0].x+dir.x, y:snake[0].y+dir.y};
      const ghost = activeEff?.type==='ghost';
      // wrap around walls if ghost, else die
      if (!ghost && (h.x<0||h.x>=COLS||h.y<0||h.y>=ROWS)) { alive=false; setStatus(`💀 Game over — Score : ${score}`); return; }
      if (ghost) { h.x=(h.x+COLS)%COLS; h.y=(h.y+ROWS)%ROWS; }
      if (!ghost && snake.some(s=>s.x===h.x&&s.y===h.y)) { alive=false; setStatus(`💀 Game over — Score : ${score}`); return; }

      snake.unshift(h);
      if (h.x===food.x&&h.y===food.y) {
        const pts = activeEff?.type==='x2' ? 2 : 1;
        score+=pts; foodCount++;
        food=rndPos([groundPU]);
        if (foodCount%4===0) spawnPU();
        setStatus(`Score : ${score}${activeEff?.type==='x2'?' ×2':''}`);
      } else snake.pop();

      if (groundPU && h.x===groundPU.x&&h.y===groundPU.y) {
        applyEff(groundPU); groundPU=null;
      }
    }
    function draw() {
      ctx.fillStyle='#06080f'; ctx.fillRect(0,0,COLS*SZ,ROWS*SZ);
      for (let x=0;x<COLS;x++) for (let y=0;y<ROWS;y++) {
        if ((x+y)%2===0) { ctx.fillStyle='#080c10'; ctx.fillRect(x*SZ,y*SZ,SZ,SZ); }
      }
      // nourriture
      ctx.fillStyle='#ff3355';
      ctx.beginPath(); ctx.arc(food.x*SZ+SZ/2,food.y*SZ+SZ/2,SZ/2-2,0,Math.PI*2); ctx.fill();

      // power-up au sol
      if (groundPU) {
        const t=Date.now(), pulse=0.75+0.25*Math.sin(t/180);
        ctx.save();
        ctx.shadowColor=groundPU.color; ctx.shadowBlur=14*pulse;
        ctx.fillStyle=groundPU.color; ctx.globalAlpha=0.85+0.15*pulse;
        ctx.beginPath(); ctx.arc(groundPU.x*SZ+SZ/2,groundPU.y*SZ+SZ/2,SZ/2-1,0,Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.globalAlpha=1;
        ctx.font=`bold ${SZ-4}px sans-serif`; ctx.textAlign='center';
        ctx.fillText(groundPU.icon, groundPU.x*SZ+SZ/2, groundPU.y*SZ+SZ-2);
        ctx.textAlign='left';
      }

      // serpent
      const ghostMode = activeEff?.type==='ghost';
      snake.forEach((s,i) => {
        const base = activeEff?.type==='speed' ? '#ffdd00'
                   : activeEff?.type==='slow'  ? '#44ddff'
                   : activeEff?.type==='x2'    ? '#ff8800'
                   : ghostMode                 ? '#aaaaff'
                   : null;
        ctx.globalAlpha = ghostMode ? 0.55 : 1;
        ctx.fillStyle = i===0 ? (base||'#00ff88') : (base ? base+'99' : `hsl(${140-i*2},80%,${Math.max(20,40-i*.4)}%)`);
        ctx.fillRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2);
      });
      ctx.globalAlpha=1;

      // barre de durée effet actif
      if (activeEff) {
        const rem=Math.max(0,(activeEff.endsAt-Date.now())/activeEff.dur);
        ctx.fillStyle='#ffffff18'; ctx.fillRect(0,ROWS*SZ-5,COLS*SZ,5);
        ctx.fillStyle=activeEff.color; ctx.fillRect(0,ROWS*SZ-5,COLS*SZ*rem,5);
      }
    }
    function loop(ts) {
      if (ts-last>stepMs) { if(alive) step(); last=ts; }
      draw(); raf=requestAnimationFrame(loop);
    }

    // 2 grands boutons tactiles
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;margin-top:12px;width:100%;max-width:440px;';
    [
      { label:'↺  GAUCHE', turn: d=>({x:d.y, y:-d.x}) },
      { label:'DROITE  ↻', turn: d=>({x:-d.y,y: d.x}) },
    ].forEach(({label,turn})=>{
      const el=document.createElement('div');
      el.style.cssText='flex:1;height:64px;display:flex;align-items:center;justify-content:center;background:#0c1220;border:1.5px solid #00d4ff55;border-radius:14px;font-size:15px;font-weight:700;color:#00d4ff;letter-spacing:1px;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;transition:background .1s;';
      el.textContent=label;
      const go=e=>{e.preventDefault();if(alive)nextDir=turn(dir);};
      el.addEventListener('touchstart',go,{passive:false});
      el.addEventListener('mousedown',go);
      el.addEventListener('touchstart',()=>{el.style.background='#1a3a5a';},{passive:true});
      el.addEventListener('touchend',()=>{el.style.background='#0c1220';},{passive:true});
      btnRow.appendChild(el);
    });
    container.appendChild(btnRow);

    init(); raf=requestAnimationFrame(loop);
    return ()=>{cancelAnimationFrame(raf);};
  };

  // ── CASSE-BRIQUES ────────────────────────────────────────────
  GameDefs.breakout = function (container, setStatus) {
    const CW=480, CH=300;
    const canvas = document.createElement('canvas');
    canvas.width=CW; canvas.height=CH;
    canvas.style.cssText='border:2px solid #00d4ff33;border-radius:6px;display:block;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const COLS=9, ROWS=5, BW=44, BH=14, HGAP=4, VGAP=4;
    const BOFFX=(CW-(COLS*(BW+HGAP)-HGAP))/2;
    const COLORS=['#ff4466','#ff8800','#ffd600','#00d4aa','#4488ff'];

    const PUDEFS = [
      { type:'wide',  icon:'⟺', color:'#00d4ff', label:'LARGE !',     dur:10000 },
      { type:'slow',  icon:'❄',  color:'#88ccff', label:'SLOW !',      dur:8000  },
      { type:'fire',  icon:'🔥', color:'#ff6600', label:'FIRE BALL !', dur:8000  },
      { type:'life',  icon:'❤',  color:'#ff3366', label:'+1 VIE !',    dur:0     },
    ];

    let paddle, ball, bricks, score, lives, running, raf;
    let fallingPUs = [];   // [{x,y,def}] capsules tombantes
    let activeEff = null;  // {type,color,endsAt,dur,origW?}
    const PH = 16, PW = 28; // capsule height/width

    function statusLine() {
      setStatus(`Score : ${score}  ·  ${'❤'.repeat(Math.max(0,lives))}`);
    }
    function init() {
      paddle={x:CW/2-44,y:CH-22,w:88,h:10};
      ball={x:CW/2,y:CH-80,r:7,dx:3.2,dy:-3.5};
      bricks=[];
      for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++)
        bricks.push({x:BOFFX+c*(BW+HGAP),y:36+r*(BH+VGAP),alive:true,color:COLORS[r]});
      score=0; lives=3; running=true; fallingPUs=[]; activeEff=null;
      statusLine();
    }

    function applyEff(def) {
      // undo previous timed effect
      if (activeEff?.type==='wide' && activeEff.origW) {
        paddle.w = activeEff.origW;
      }
      if (def.type==='life') {
        lives=Math.min(5,lives+1);
        setStatus(def.label);
        setTimeout(statusLine, 1200);
        return;
      }
      activeEff={...def, endsAt:Date.now()+def.dur};
      if (def.type==='wide') {
        activeEff.origW=paddle.w;
        paddle.w=Math.min(CW*0.55, paddle.w+48);
      }
      if (def.type==='slow') {
        const spd=Math.hypot(ball.dx,ball.dy);
        ball.dx*=0.6; ball.dy*=0.6;
      }
      setStatus(def.label);
      setTimeout(statusLine, 1200);
    }

    function step() {
      // expire active effect
      if (activeEff && Date.now()>activeEff.endsAt) {
        if (activeEff.type==='wide' && activeEff.origW) {
          paddle.w=activeEff.origW;
        }
        if (activeEff.type==='slow') {
          const spd=Math.hypot(ball.dx,ball.dy);
          if (spd<4) { const f=4/spd; ball.dx*=f; ball.dy*=f; }
        }
        activeEff=null;
      }

      ball.x+=ball.dx; ball.y+=ball.dy;
      if (ball.x-ball.r<0){ball.x=ball.r;ball.dx=Math.abs(ball.dx);}
      if (ball.x+ball.r>CW){ball.x=CW-ball.r;ball.dx=-Math.abs(ball.dx);}
      if (ball.y-ball.r<0){ball.y=ball.r;ball.dy=Math.abs(ball.dy);}
      if (ball.y+ball.r>CH) {
        lives--;
        if (activeEff?.type==='wide' && activeEff.origW) paddle.w=activeEff.origW;
        activeEff=null; fallingPUs=[];
        if (!lives){running=false;setStatus(`💀 Game over — Score : ${score}`);return;}
        ball.x=CW/2;ball.y=CH-80;ball.dx=3.2;ball.dy=-3.5;
        statusLine();
      }
      // paddle bounce
      if (ball.y+ball.r>=paddle.y&&ball.y-ball.r<paddle.y+paddle.h&&
          ball.x>=paddle.x&&ball.x<=paddle.x+paddle.w) {
        const rel=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);
        ball.dx=rel*5.5; ball.dy=-Math.abs(ball.dy);
      }
      // brick collision
      const fire=activeEff?.type==='fire';
      for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x+ball.r>b.x&&ball.x-ball.r<b.x+BW&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+BH) {
          b.alive=false; score+=10;
          if (!fire) ball.dy=-ball.dy;
          statusLine();
          // 30% chance spawn power-up
          if (Math.random()<0.30) {
            const def=PUDEFS[Math.floor(Math.random()*PUDEFS.length)];
            fallingPUs.push({x:b.x+BW/2-PW/2, y:b.y+BH, def});
          }
          if (!fire) break;
        }
      }
      if (bricks.every(b=>!b.alive)){running=false;setStatus(`🏆 Victoire ! Score : ${score}`);}

      // move falling power-ups
      for (let i=fallingPUs.length-1;i>=0;i--) {
        fallingPUs[i].y+=2.5;
        const p=fallingPUs[i];
        if (p.y+PH>=paddle.y && p.y<=paddle.y+paddle.h &&
            p.x+PW>=paddle.x && p.x<=paddle.x+paddle.w) {
          applyEff(p.def); fallingPUs.splice(i,1);
        } else if (p.y>CH) {
          fallingPUs.splice(i,1);
        }
      }
    }
    function draw() {
      ctx.fillStyle='#06080f'; ctx.fillRect(0,0,CW,CH);
      bricks.forEach(b => {
        if (!b.alive) return;
        ctx.fillStyle=b.color; ctx.fillRect(b.x,b.y,BW,BH);
        ctx.fillStyle='rgba(255,255,255,.18)'; ctx.fillRect(b.x,b.y,BW,4);
      });

      // falling capsules
      fallingPUs.forEach(p=>{
        ctx.fillStyle=p.def.color+'cc';
        ctx.beginPath();
        const r=PH/2;
        ctx.roundRect(p.x,p.y,PW,PH,r);
        ctx.fill();
        ctx.font='bold 11px sans-serif'; ctx.textAlign='center';
        ctx.fillStyle='#fff';
        ctx.fillText(p.def.icon, p.x+PW/2, p.y+PH-3);
        ctx.textAlign='left';
      });

      // paddle
      const pg=ctx.createLinearGradient(paddle.x,0,paddle.x+paddle.w,0);
      const pc=activeEff?.type==='wide'?'#00ffcc':activeEff?.type==='slow'?'#88ccff':activeEff?.type==='fire'?'#ff6600':'#00d4ff';
      pg.addColorStop(0,'#00aacc'); pg.addColorStop(1,pc);
      ctx.fillStyle=pg; ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);

      // ball
      const ballColor=activeEff?.type==='fire'?'#ff6600':'#ffffff';
      ctx.fillStyle=ballColor;
      ctx.shadowColor=ballColor; ctx.shadowBlur=activeEff?.type==='fire'?18:10;
      ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;

      // barre effet actif
      if (activeEff) {
        const rem=Math.max(0,(activeEff.endsAt-Date.now())/activeEff.dur);
        ctx.fillStyle='#ffffff18'; ctx.fillRect(0,CH-5,CW,5);
        ctx.fillStyle=activeEff.color; ctx.fillRect(0,CH-5,CW*rem,5);
      }
    }
    function loop() { if (running) step(); draw(); raf=requestAnimationFrame(loop); }

    function movePaddle(clientX, rect) {
      const scale = CW / rect.width;
      paddle.x = Math.max(0, Math.min(CW - paddle.w, (clientX - rect.left) * scale - paddle.w / 2));
    }
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      movePaddle(e.touches[0].clientX, canvas.getBoundingClientRect());
    }, { passive: false });
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      movePaddle(e.touches[0].clientX, canvas.getBoundingClientRect());
    }, { passive: false });
    canvas.addEventListener('mousemove', e => {
      movePaddle(e.clientX, canvas.getBoundingClientRect());
    });
    init(); raf=requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  };

  // ── MEMORY ───────────────────────────────────────────────────
  GameDefs.memory = function (container, setStatus) {
    const EMOJIS=['🐬','🦀','🐙','⭐','🌊','🦞','🐚','🦑','🦈','🐠','🦭','🐡'];
    const PAIRS=[...EMOJIS,...EMOJIS].sort(()=>Math.random()-.5);
    let flipped=[], matched=new Set(), moves=0, lock=false;

    const grid=document.createElement('div');
    grid.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:6px;max-width:400px;';
    container.appendChild(grid);

    const cards=PAIRS.map((emoji,i)=>{
      const el=document.createElement('div');
      el.style.cssText='width:54px;height:54px;display:flex;align-items:center;justify-content:center;background:#1a4a7a;border:1.5px solid #4a90d9;border-radius:8px;cursor:pointer;font-size:26px;transition:all .18s;user-select:none;';
      el.textContent='?';
      el.style.color='#ffffff';
      el.addEventListener('click',()=>flip(i));
      grid.appendChild(el);
      return {el,emoji};
    });

    function reveal(i,hit){
      cards[i].el.textContent=cards[i].emoji;
      cards[i].el.style.color='#fff';
      cards[i].el.style.background=hit?'#0a3020':'#1a3a6a';
      cards[i].el.style.borderColor=hit?'#00ff88':'#00d4ff';
    }
    function hide(i){
      cards[i].el.textContent='?';
      cards[i].el.style.color='#ffffff';
      cards[i].el.style.background='#1a4a7a';
      cards[i].el.style.borderColor='#4a90d9';
    }
    function flip(i){
      if (lock||matched.has(i)||flipped.includes(i)) return;
      reveal(i,false); flipped.push(i);
      if (flipped.length===2){
        moves++;
        lock=true;
        const [a,b]=flipped;
        if (cards[a].emoji===cards[b].emoji){
          matched.add(a); matched.add(b);
          reveal(a,true); reveal(b,true);
          flipped=[]; lock=false;
          if (matched.size===PAIRS.length) setStatus(`🏆 Gagné en ${moves} coups !`);
          else setStatus(`Coups : ${moves}  ·  Paires : ${matched.size/2} / ${EMOJIS.length}`);
        } else {
          setStatus(`Coups : ${moves}`);
          setTimeout(()=>{ hide(a); hide(b); flipped=[]; lock=false; },900);
        }
      }
    }
    setStatus('Retrouvez les paires 🌊');
  };

  // ── FLAPPY BIRD ──────────────────────────────────────────────
  GameDefs.flappy = function (container, setStatus) {
    const CW=340, CH=420;
    const canvas=document.createElement('canvas');
    canvas.width=CW; canvas.height=CH;
    canvas.style.cssText='border:2px solid #00d4ff33;border-radius:6px;display:block;touch-action:none;';
    container.appendChild(canvas);
    const ctx=canvas.getContext('2d');

    const GRAVITY=0.38, JUMP=-7, PIPE_W=46, GAP=115, SCROLL=2.6;
    let bird, pipes, score, alive, started, frame, raf;

    function init() {
      bird={x:80, y:CH/2, vy:0};
      pipes=[]; score=0; alive=true; started=false; frame=0;
      setStatus('Tapez pour voler !');
    }

    function jump() {
      if (!started) { started=true; }
      bird.vy=JUMP;
    }

    function step() {
      if (!started) return;
      frame++;
      bird.vy+=GRAVITY; bird.y+=bird.vy;
      if (frame%85===0) {
        const top=55+Math.random()*(CH-GAP-100);
        pipes.push({x:CW+10, top});
      }
      pipes.forEach(p=>{
        p.x-=SCROLL;
        if (!p.scored && p.x+PIPE_W<bird.x) {
          p.scored=true; score++;
          setStatus(`Score : ${score}`);
        }
      });
      pipes=pipes.filter(p=>p.x>-PIPE_W-10);
      if (bird.y-9<0||bird.y+9>CH) { die(); return; }
      for (const p of pipes) {
        if (bird.x+8>p.x&&bird.x-8<p.x+PIPE_W) {
          if (bird.y-9<p.top||bird.y+9>p.top+GAP) { die(); return; }
        }
      }
    }

    function die() {
      alive=false; started=false;
      setStatus(`💀 Score : ${score} — Tapez pour rejouer`);
    }

    function draw() {
      // ciel
      const sky=ctx.createLinearGradient(0,0,0,CH);
      sky.addColorStop(0,'#0a1628'); sky.addColorStop(1,'#0d2a48');
      ctx.fillStyle=sky; ctx.fillRect(0,0,CW,CH);
      // tuyaux
      for (const p of pipes) {
        ctx.fillStyle='#1f6b38';
        ctx.fillRect(p.x,0,PIPE_W,p.top);
        ctx.fillRect(p.x,p.top+GAP,PIPE_W,CH);
        ctx.fillStyle='#2a8a4a';
        ctx.fillRect(p.x-5,p.top-18,PIPE_W+10,18);
        ctx.fillRect(p.x-5,p.top+GAP,PIPE_W+10,18);
      }
      // sol
      ctx.fillStyle='#1a3020'; ctx.fillRect(0,CH-4,CW,4);
      // oiseau
      ctx.save();
      ctx.translate(bird.x,bird.y);
      const tilt=Math.min(Math.PI*0.35,Math.max(-0.4,bird.vy*0.045));
      ctx.rotate(tilt);
      ctx.fillStyle='#ffd700';
      ctx.beginPath(); ctx.ellipse(0,0,13,9,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff8800';
      ctx.beginPath(); ctx.moveTo(9,-2); ctx.lineTo(15,0); ctx.lineTo(9,3); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(5,-3,4.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(6.5,-3,2.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffd700'; ctx.beginPath(); ctx.arc(-3,-10,5,0,Math.PI); ctx.fill();
      ctx.restore();
      // écran de départ
      if (!started) {
        ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,CH/2-34,CW,66);
        ctx.fillStyle='#ffd700'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
        ctx.fillText(alive?'Tapez pour commencer':'Tapez pour rejouer',CW/2,CH/2+7);
        ctx.textAlign='left';
      }
    }

    function loop() {
      step(); draw(); raf=requestAnimationFrame(loop);
    }

    // bouton tactile
    const btn=document.createElement('div');
    btn.style.cssText='width:100%;max-width:340px;height:60px;display:flex;align-items:center;justify-content:center;background:#0c1220;border:1.5px solid #ffd70066;border-radius:14px;font-size:15px;font-weight:700;color:#ffd700;cursor:pointer;user-select:none;touch-action:manipulation;margin-top:8px;';
    btn.textContent='✦  VOLER  ✦';
    const doJump=e=>{e.preventDefault();if(!alive)init();jump();};
    btn.addEventListener('touchstart',doJump,{passive:false});
    btn.addEventListener('mousedown',doJump);
    btn.addEventListener('touchstart',()=>{btn.style.background='#1a2200';},{passive:true});
    btn.addEventListener('touchend',()=>{btn.style.background='#0c1220';},{passive:true});
    container.appendChild(btn);

    init(); raf=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf);
  };

  // ── PONG ─────────────────────────────────────────────────────
  GameDefs.pong = function (container, setStatus) {
    const CW=480, CH=280;
    const canvas=document.createElement('canvas');
    canvas.width=CW; canvas.height=CH;
    canvas.style.cssText='border:2px solid #00d4ff33;border-radius:6px;display:block;touch-action:none;';
    container.appendChild(canvas);
    const ctx=canvas.getContext('2d');

    const PW=10, PH=65, SPD=4.8;
    let p1, p2, ball, s1, s2, running, raf;
    const MAX_SCORE=7;

    function init() {
      p1={x:14, y:CH/2-PH/2};
      p2={x:CW-14-PW, y:CH/2-PH/2};
      ball={x:CW/2,y:CH/2,dx:SPD*(Math.random()<.5?1:-1),dy:(Math.random()*2-1)*SPD*.6};
      s1=0; s2=0; running=true;
      setStatus(`J1 ◀  0 : 0  ▶ J2  (premier à ${MAX_SCORE})`);
    }

    function movePaddle(pad, cy, rect) {
      const scale=CH/rect.height;
      pad.y=Math.max(0,Math.min(CH-PH,(cy-rect.top)*scale-PH/2));
    }

    function handleTouch(e) {
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      for (let i=0;i<e.touches.length;i++) {
        const t=e.touches[i];
        const tx=(t.clientX-rect.left)*(CW/rect.width);
        movePaddle(tx<CW/2?p1:p2, t.clientY, rect);
      }
    }
    canvas.addEventListener('touchmove',handleTouch,{passive:false});
    canvas.addEventListener('touchstart',handleTouch,{passive:false});
    canvas.addEventListener('mousemove',e=>{
      const rect=canvas.getBoundingClientRect();
      const tx=(e.clientX-rect.left)*(CW/rect.width);
      movePaddle(tx<CW/2?p1:p2, e.clientY, rect);
    });

    function step() {
      ball.x+=ball.dx; ball.y+=ball.dy;
      if (ball.y-6<0){ball.y=6;ball.dy=Math.abs(ball.dy);}
      if (ball.y+6>CH){ball.y=CH-6;ball.dy=-Math.abs(ball.dy);}
      // P1 paddle
      if (ball.dx<0&&ball.x-6<=p1.x+PW&&ball.x>p1.x&&ball.y>=p1.y-6&&ball.y<=p1.y+PH+6) {
        ball.x=p1.x+PW+6; ball.dx=Math.abs(ball.dx)*1.03;
        ball.dy=((ball.y-(p1.y+PH/2))/(PH/2))*SPD;
      }
      // P2 paddle
      if (ball.dx>0&&ball.x+6>=p2.x&&ball.x<p2.x+PW&&ball.y>=p2.y-6&&ball.y<=p2.y+PH+6) {
        ball.x=p2.x-6; ball.dx=-Math.abs(ball.dx)*1.03;
        ball.dy=((ball.y-(p2.y+PH/2))/(PH/2))*SPD;
      }
      // cap speed
      const spd=Math.hypot(ball.dx,ball.dy);
      if(spd>SPD*2){ball.dx*=(SPD*2/spd);ball.dy*=(SPD*2/spd);}

      if (ball.x<-10) {
        s2++; check();
        ball={x:CW/2,y:CH/2,dx:-SPD,dy:(Math.random()*2-1)*SPD*.5};
      }
      if (ball.x>CW+10) {
        s1++; check();
        ball={x:CW/2,y:CH/2,dx:SPD,dy:(Math.random()*2-1)*SPD*.5};
      }
    }
    function check() {
      if(s1>=MAX_SCORE){running=false;setStatus(`🏆 Joueur 1 gagne ! (${s1}:${s2})`);}
      else if(s2>=MAX_SCORE){running=false;setStatus(`🏆 Joueur 2 gagne ! (${s1}:${s2})`);}
      else setStatus(`J1 ◀  ${s1} : ${s2}  ▶ J2`);
    }

    function draw() {
      ctx.fillStyle='#06080f'; ctx.fillRect(0,0,CW,CH);
      // ligne centrale
      ctx.setLineDash([10,10]); ctx.strokeStyle='#ffffff12'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(CW/2,0); ctx.lineTo(CW/2,CH); ctx.stroke();
      ctx.setLineDash([]);
      // scores décoratifs
      ctx.font='bold 44px Courier New'; ctx.fillStyle='#ffffff18'; ctx.textAlign='center';
      ctx.fillText(s1,CW/4,CH/2+16); ctx.fillText(s2,3*CW/4,CH/2+16);
      ctx.textAlign='left';
      // raquettes
      const pg1=ctx.createLinearGradient(p1.x,p1.y,p1.x,p1.y+PH);
      pg1.addColorStop(0,'#00aacc'); pg1.addColorStop(1,'#00d4ff');
      ctx.fillStyle=pg1; ctx.fillRect(p1.x,p1.y,PW,PH);
      const pg2=ctx.createLinearGradient(p2.x,p2.y,p2.x,p2.y+PH);
      pg2.addColorStop(0,'#ff4466'); pg2.addColorStop(1,'#ff88aa');
      ctx.fillStyle=pg2; ctx.fillRect(p2.x,p2.y,PW,PH);
      // balle
      ctx.fillStyle='#fff'; ctx.shadowColor='#fff'; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(ball.x,ball.y,6,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      // labels joueurs
      ctx.font='bold 9px Courier New'; ctx.fillStyle='#00d4ff66'; ctx.textAlign='center';
      ctx.fillText('J1',p1.x+PW/2,CH-5); ctx.fillText('J2',p2.x+PW/2,CH-5);
      ctx.textAlign='left';
    }

    function loop(){if(running)step();draw();raf=requestAnimationFrame(loop);}

    // astuce tactile
    const hint=document.createElement('div');
    hint.style.cssText='font-size:11px;color:#3a6080;text-align:center;margin-top:6px;';
    hint.textContent='Chaque joueur glisse son doigt sur sa moitié (gauche / droite)';
    container.appendChild(hint);

    init(); raf=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf);
  };

  // ── TAQUIN ───────────────────────────────────────────────────
  GameDefs.taquin = function (container, setStatus) {
    const N=4, SZ=76;
    const canvas=document.createElement('canvas');
    canvas.width=N*SZ; canvas.height=N*SZ;
    canvas.style.cssText='border:2px solid #00d4ff33;border-radius:6px;display:block;touch-action:none;';
    container.appendChild(canvas);
    const ctx=canvas.getContext('2d');

    let grid, moves, done, raf;

    function shuffle(g) {
      for (let i=0;i<600;i++){
        const e=g.indexOf(0), ex=e%N, ey=Math.floor(e/N);
        const nb=[];
        if(ex>0)nb.push(e-1); if(ex<N-1)nb.push(e+1);
        if(ey>0)nb.push(e-N); if(ey<N-1)nb.push(e+N);
        const s=nb[Math.floor(Math.random()*nb.length)];
        [g[e],g[s]]=[g[s],g[e]];
      }
    }

    function init() {
      grid=Array.from({length:N*N},(_,i)=>i===N*N-1?0:i+1);
      shuffle(grid); moves=0; done=false;
      setStatus('Tapez une tuile adjacente à la case vide');
    }

    function tap(idx) {
      if(done) return;
      const e=grid.indexOf(0), ex=e%N, ey=Math.floor(e/N);
      const ix=idx%N, iy=Math.floor(idx/N);
      if(Math.abs(ex-ix)+Math.abs(ey-iy)!==1) return;
      [grid[e],grid[idx]]=[grid[idx],grid[e]];
      moves++;
      if(grid.every((v,i)=>v===(i===N*N-1?0:i+1))){
        done=true; setStatus(`🏆 Résolu en ${moves} coups !`);
      } else {
        setStatus(`Coups : ${moves}`);
      }
    }

    function draw() {
      ctx.fillStyle='#f0f0f0'; ctx.fillRect(0,0,N*SZ,N*SZ);
      const e=grid.indexOf(0);
      for(let i=0;i<N*N;i++){
        const v=grid[i], x=(i%N)*SZ, y=Math.floor(i/N)*SZ;
        if(v===0){
          ctx.fillStyle='#c8cfd6'; ctx.fillRect(x+3,y+3,SZ-6,SZ-6);
          continue;
        }
        const correct=v===i+1;
        ctx.fillStyle=correct?'#c8e6c9':'#ffffff';
        ctx.fillRect(x+3,y+3,SZ-6,SZ-6);
        ctx.strokeStyle=correct?'#2e7d32':'#bdbdbd';
        ctx.lineWidth=1.5; ctx.strokeRect(x+3,y+3,SZ-6,SZ-6);
        // reflet haut
        ctx.fillStyle='rgba(0,0,0,.04)'; ctx.fillRect(x+3,y+3,SZ-6,8);
        ctx.fillStyle=correct?'#1b5e20':'#424242';
        ctx.font=`bold ${v>9?20:24}px Courier New`; ctx.textAlign='center';
        ctx.fillText(v,x+SZ/2,y+SZ/2+8);
        ctx.textAlign='left';
      }
    }

    function getIdx(cx,cy,rect){
      const sx=(cx-rect.left)*(N*SZ/rect.width);
      const sy=(cy-rect.top)*(N*SZ/rect.height);
      return Math.floor(sy/SZ)*N+Math.floor(sx/SZ);
    }
    canvas.addEventListener('touchstart',e=>{
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      tap(getIdx(e.touches[0].clientX,e.touches[0].clientY,rect));
    },{passive:false});
    canvas.addEventListener('mousedown',e=>{
      const rect=canvas.getBoundingClientRect();
      tap(getIdx(e.clientX,e.clientY,rect));
    });

    function loop(){draw();raf=requestAnimationFrame(loop);}
    init(); raf=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf);
  };

  // ── SIMON ────────────────────────────────────────────────────
  GameDefs.simon = function (container, setStatus) {
    const PANELS=[
      {bg:'#8b0000', hi:'#ff3333', name:'ROUGE'},
      {bg:'#004a99', hi:'#3399ff', name:'BLEU'},
      {bg:'#006b2a', hi:'#33cc66', name:'VERT'},
      {bg:'#8b6200', hi:'#ffcc00', name:'JAUNE'},
    ];

    let seq, step, lock, destroyed;

    const wrap=document.createElement('div');
    wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;';
    container.appendChild(wrap);

    const grid=document.createElement('div');
    grid.style.cssText='display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-width:320px;width:100%;';
    wrap.appendChild(grid);

    const els=PANELS.map((p,i)=>{
      const el=document.createElement('div');
      el.style.cssText=`height:90px;border-radius:14px;background:${p.bg};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,.55);user-select:none;touch-action:manipulation;transition:filter .1s;`;
      el.textContent=p.name;
      grid.appendChild(el);
      return el;
    });

    function flash(i,dur=380){
      return new Promise(r=>{
        els[i].style.background=PANELS[i].hi;
        els[i].style.filter='brightness(1.3)';
        setTimeout(()=>{
          els[i].style.background=PANELS[i].bg;
          els[i].style.filter='';
          setTimeout(r,90);
        },dur);
      });
    }

    async function showSeq(){
      lock=true;
      setStatus(`Niveau ${seq.length} — Regardez…`);
      await new Promise(r=>setTimeout(r,600));
      for(const s of seq){
        if(destroyed)return;
        await flash(s);
        await new Promise(r=>setTimeout(r,120));
      }
      lock=false; step=0;
      setStatus(`Niveau ${seq.length} — À vous !`);
    }

    function init(){
      destroyed=false;
      seq=[Math.floor(Math.random()*4)]; step=0; lock=false;
      showSeq();
    }

    function tap(i){
      if(lock||destroyed) return;
      flash(i,200);
      if(i!==seq[step]){
        lock=true;
        setStatus(`❌ Raté au niveau ${seq.length} !  Reprise dans 2s…`);
        setTimeout(()=>{
          if(!destroyed){seq=[Math.floor(Math.random()*4)];showSeq();}
        },2000);
        return;
      }
      step++;
      if(step===seq.length){
        lock=true;
        setStatus(`✅ Niveau ${seq.length} réussi !`);
        setTimeout(()=>{
          if(!destroyed){seq.push(Math.floor(Math.random()*4));showSeq();}
        },900);
      }
    }

    els.forEach((el,i)=>{
      el.addEventListener('touchstart',e=>{e.preventDefault();tap(i);},{passive:false});
      el.addEventListener('mousedown',()=>tap(i));
    });

    const hint=document.createElement('div');
    hint.style.cssText='font-size:11px;color:#3a6080;text-align:center;';
    hint.textContent='Reproduisez la séquence — chaque niveau ajoute un coup';
    wrap.appendChild(hint);

    init();
    return ()=>{destroyed=true;};
  };

  // ═══════════════════════════════════════════════════════════
  //  ACTIVATION
  // ═══════════════════════════════════════════════════════════
  function wire() {
    const el = document.querySelector('.site-footer-credit');
    if (el) el.addEventListener('click', openArcade);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

})();
