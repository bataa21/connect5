/* app.js — game logic + UI (no PWA code here) */

// Welcome overlay (called by inline onclick in index.html)
window.hideWelcomeScreen = function () {
  const w = document.getElementById('welcome-screen');
  if (w) w.style.display = 'none';
};
window.addEventListener('load', () => {
  const w = document.getElementById('welcome-screen');
  if (w) w.style.display = 'flex';
});

// Sounds (optional assets in the root)
const SOUNDS = { MOVE: 'move-sound.mp3', WIN: 'win-sound.mp3', DRAW: 'draw-sound.mp3' };

// i18n
const translations = {
  mn: {
    title: '5-ыг холбо',
    vsFriend: 'Найз',
    vsComputer: 'AI',
    easy: 'Хялбар',
    medium: 'Дунд',
    hard: 'Хэцүү',
    reset: 'Шинэ',
    aiFirst: 'Ai эхлэх',
    yourTurn: 'Таны ээлж',
    aiThinking: 'AI бодож байна...',
    xWins: 'X хожлоо! 🎉',
    oWins: 'O хожлоо! 🎉',
    draw: 'Тэнцлээ!',
    playerTurn: 'Тоглогч {{player}}-ийн ээлж',
    soundOn: 'Дуутай',
    soundOff: 'Дуугүй',
    guaranteedDraw: 'Тэнцэх нь баталгаатай — Шинэ товчийг дарж дахин эхлүүлээрэй',
    likelyDraw: 'Тэнцэх магадлал өндөр — хүсвэл Шинэ товчийг дарж дахин эхлүүлж болно',
    iosHint: 'iPhone дээр: Share → “Add to Home Screen”-г сонгоно уу.'
  },
  en: {
    title: 'Connect 5',
    vsFriend: 'Friend',
    vsComputer: 'AI',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    reset: 'New',
    aiFirst: 'AI Starts',
    yourTurn: 'Your turn',
    aiThinking: 'AI is thinking...',
    xWins: 'X wins! 🎉',
    oWins: 'O wins! 🎉',
    draw: "It's a draw!",
    playerTurn: "Player {{player}}'s turn",
    soundOn: 'Sound On',
    soundOff: 'Sound Off',
    guaranteedDraw: 'Draw is guaranteed — press New to restart',
    likelyDraw: 'Likely draw — you can stop and press New to restart',
    iosHint: 'On iPhone: tap Share → “Add to Home Screen”.'
  }
};


// Toast + inline pill banner
function showToast(message, variant = 'info', ms = 2400) {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast--${variant}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  }, ms);
}
function showBanner(msg, variant) {
  const b = document.getElementById('banner');
  if (!b) return;
  b.innerHTML = '';
  b.className = 'notice';
  if (!msg) return;
  const pill = document.createElement('div');
  pill.className = `pill pill--${variant || 'info'}`;
  const iconMap = { success: '✓', warning: '⏳', info: 'ℹ︎' };
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = iconMap[variant] || iconMap.info;
  const text = document.createElement('span');
  text.textContent = msg;
  pill.appendChild(icon);
  pill.appendChild(text);
  b.appendChild(pill);
}

document.addEventListener('DOMContentLoaded', () => {
  // ======= Constants =======
  const SIZE = 10, WIN = 5;

  // Precompute all 5-in-a-row segments (for draw analysis)
  const SEGMENTS = (() => {
    const segs = [];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x <= SIZE - WIN; x++)
        segs.push(Array.from({ length: WIN }, (_, i) => ({ x: x + i, y })));
    for (let x = 0; x < SIZE; x++)
      for (let y = 0; y <= SIZE - WIN; y++)
        segs.push(Array.from({ length: WIN }, (_, i) => ({ x, y: y + i })));
    for (let y = 0; y <= SIZE - WIN; y++)
      for (let x = 0; x <= SIZE - WIN; x++)
        segs.push(Array.from({ length: WIN }, (_, i) => ({ x: x + i, y: y + i })));
    for (let y = WIN - 1; y < SIZE; y++)
      for (let x = 0; x <= SIZE - WIN; x++)
        segs.push(Array.from({ length: WIN }, (_, i) => ({ x: x + i, y: y - i })));
    return segs;
  })();

  // ======= DOM refs =======
  const boardEl = document.getElementById('board');
  const thinkingEl = document.getElementById('thinking');
  const resetBtn = document.getElementById('resetButton');
  const diffSel = document.getElementById('difficulty');
  const segFriend = document.getElementById('segFriend');
  const segAI = document.getElementById('segAI');
  const langSel = document.getElementById('languageSelect');
  const titleEl = document.getElementById('gameTitle');
  const soundBtn = document.getElementById('soundToggle');
  const aiStartBtn = document.getElementById('alternateStartButton');

  // ======= State =======
  let board = Array(SIZE).fill().map(() => Array(SIZE).fill(''));
  let current = 'X';
  let gameOver = false;
  let winCells = [];
  let moveCount = 0;
  let mode = 'computer';
  let botStartsNext = false;
  let lang = 'mn';
  let soundOn = true;
  let forcedDrawNotified = false;
  let likelyDrawNotified = false;

  // ======= i18n helpers =======
  function t(key, params = {}) {
    let s = translations[lang][key];
    for (const [k, v] of Object.entries(params)) s = s.replace(`{{${k}}}`, v);
    return s;
  }
  function updateTopTexts() {
    titleEl.textContent = translations[lang].title;
    segFriend.querySelector('.seg-text').textContent = translations[lang].vsFriend;
    segAI.querySelector('.seg-text').textContent = translations[lang].vsComputer;
    diffSel.querySelector('[value="easy"]').textContent = translations[lang].easy;
    diffSel.querySelector('[value="medium"]').textContent = translations[lang].medium;
    diffSel.querySelector('[value="hard"]').textContent = translations[lang].hard;
    resetBtn.textContent = translations[lang].reset;
    aiStartBtn.textContent = translations[lang].aiFirst;
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.title = soundOn ? translations[lang].soundOn : translations[lang].soundOff;
    updateStatus();
  }

  // ======= Sound =======
  function playSound(k) {
    if (!soundOn || !SOUNDS[k]) return;
    try {
      const a = new Audio(SOUNDS[k]);
      a.volume = 0.3;
      a.play().catch(() => {
        soundOn = false;
        updateTopTexts();
      });
    } catch {
      soundOn = false;
      updateTopTexts();
    }
  }

  // ======= Board =======
  function createBoard() {
    board = Array(SIZE).fill().map(() => Array(SIZE).fill(''));
    boardEl.innerHTML = '';
    moveCount = 0; gameOver = false; winCells = [];
    thinkingEl.textContent = '';
    showBanner('', null);
    forcedDrawNotified = false;
    likelyDrawNotified = false;

    if (mode === 'computer' && botStartsNext) {
      current = 'O'; botStartsNext = false; updateStatus(); setTimeout(makeAIMove, 380);
    } else {
      current = 'X';
    }

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = document.createElement('div');
        c.className = 'cell';
        c.dataset.x = x;
        c.dataset.y = y;
        c.addEventListener('click', onCell);
        boardEl.appendChild(c);
      }
    }
    updateBoard();
    updateStatus();
    saveState();
  }

  function onCell(e) {
    if (gameOver) return;
    if (mode === 'computer' && current !== 'X') return;
    const x = +e.currentTarget.dataset.x, y = +e.currentTarget.dataset.y;
    if (board[y][x] !== '') return;
    makeMove(x, y, current);
    if (!gameOver) {
      current = (current === 'X') ? 'O' : 'X';
      updateStatus();
      if (mode === 'computer' && current === 'O') setTimeout(makeAIMove, 350);
    }
  }

  function updateBoard() {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const el = boardEl.children[y * SIZE + x];
        el.textContent = board[y][x];
        el.className = 'cell';
        if (board[y][x] === 'X') el.classList.add('x');
        if (board[y][x] === 'O') el.classList.add('o');
      }
    }
  }

  function makeMove(x, y, sym) {
    board[y][x] = sym; moveCount++; updateBoard(); playSound('MOVE');
    document.querySelectorAll('.cell-last-move').forEach(n => n.classList.remove('cell-last-move'));
    const last = boardEl.children[y * SIZE + x]; if (last) last.classList.add('cell-last-move');

    if (checkWin(sym)) {
      highlightWins();
      gameOver = true; thinkingEl.textContent = ''; playSound('WIN');
      const msg = (sym === 'X') ? translations[lang].xWins : translations[lang].oWins;
      showToast(msg, 'success', 2600);
      showBanner(msg, 'success');
      if (sym === 'X' && window.confetti) {
        confetti({ particleCount: 200, spread: 70, origin: { y: .6 }, zIndex: 9999 });
        document.body.classList.add('win-effect');
      }
    } else if (!forcedDrawNotified && isForcedDraw()) {
      // Strong “draw guaranteed”
      forcedDrawNotified = true;
      const msg = translations[lang].guaranteedDraw;
      showToast(msg, 'warning', 3400);
      showBanner(msg, 'warning');
    } else if (!forcedDrawNotified && isLikelyDraw()) {
      // Early “likely draw” hint
      if (!likelyDrawNotified) {
        likelyDrawNotified = true;
        const msg = translations[lang].likelyDraw;
        showToast(msg, 'info', 2600);
        showBanner(msg, 'info');
      }
    } else if (!forcedDrawNotified && likelyDrawNotified && !isLikelyDraw()) {
      // Threats changed—remove hint
      likelyDrawNotified = false;
      showBanner('', null);
    } else if (isFull()) {
      gameOver = true; thinkingEl.textContent = ''; playSound('DRAW');
      const msg = translations[lang].draw;
      showToast(msg, 'info', 2600);
      showBanner(msg, 'info');
    }
    saveState();
  }

  function updateStatus() {
    if (gameOver) return;
    if (mode === 'friend') thinkingEl.textContent = t('playerTurn', { player: current });
    else thinkingEl.textContent = (current === 'X') ? translations[lang].yourTurn : translations[lang].aiThinking;
  }

  function isFull() { return board.flat().every(c => c !== ''); }

  function checkWin(sym) {
    winCells = [];
    const dirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== sym) continue;
      for (const d of dirs) {
        let count = 1, cells = [{ x, y }];
        for (let i = 1; i < WIN; i++) {
          const nx = x + d.dx * i, ny = y + d.dy * i;
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || board[ny][nx] !== sym) break;
          count++; cells.push({ x: nx, y: ny });
        }
        for (let i = 1; i < WIN; i++) {
          const nx = x - d.dx * i, ny = y - d.dy * i;
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || board[ny][nx] !== sym) break;
          count++; cells.push({ x: nx, y: ny });
        }
        if (count >= WIN) { winCells = cells.slice(0, WIN); return true; }
      }
    }
    return false;
  }

  function highlightWins() {
    document.querySelectorAll('.cell.winning').forEach(n => n.classList.remove('winning'));
    winCells.forEach(({ x, y }) => {
      const el = boardEl.children[y * SIZE + x];
      if (el) el.classList.add('winning');
    });
  }

  // ======= Draw analysis =======
  function emptyCount() { let e = 0; for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (board[y][x] === '') e++; return e; }
  function movesLeftFor(sym) {
    const E = emptyCount();
    const xToMove = (current === 'X');
    if (sym === 'X') return xToMove ? Math.ceil(E / 2) : Math.floor(E / 2);
    return xToMove ? Math.floor(E / 2) : Math.ceil(E / 2);
  }
  function minEmptiesToWin(sym) {
    const opp = (sym === 'X') ? 'O' : 'X';
    let best = Infinity;
    for (const seg of SEGMENTS) {
      let blocked = false, blanks = 0;
      for (const { x, y } of seg) {
        const v = board[y][x];
        if (v === opp) { blocked = true; break; }
        if (v === '') blanks++;
      }
      if (!blocked) best = Math.min(best, blanks);
    }
    return best;
  }
  function hasOpenFiveFor(sym) {
    const opp = (sym === 'X') ? 'O' : 'X';
    for (const seg of SEGMENTS) {
      let blocked = false;
      for (const { x, y } of seg) { if (board[y][x] === opp) { blocked = true; break; } }
      if (!blocked) return true;
    }
    return false;
  }
  function openSegmentsStats(sym) {
    const opp = (sym === 'X') ? 'O' : 'X';
    let countOpen = 0, bestSymbols = 0;
    for (const seg of SEGMENTS) {
      let blocked = false, symCount = 0;
      for (const { x, y } of seg) {
        const v = board[y][x];
        if (v === opp) { blocked = true; break; }
        if (v === sym) symCount++;
      }
      if (!blocked) { countOpen++; if (symCount > bestSymbols) bestSymbols = symCount; }
    }
    return { countOpen, bestSymbols };
  }
  function isForcedDraw() {
    const noOpenX = !hasOpenFiveFor('X');
    const noOpenO = !hasOpenFiveFor('O');
    const needX = minEmptiesToWin('X');
    const needO = minEmptiesToWin('O');
    const leftX = movesLeftFor('X');
    const leftO = movesLeftFor('O');
    const budgetFailX = needX > leftX;
    const budgetFailO = needO > leftO;
    return ((noOpenX || budgetFailX) && (noOpenO || budgetFailO));
  }
  function isLikelyDraw() {
    if (isForcedDraw()) return false;
    const E = emptyCount();
    const needX = minEmptiesToWin('X');
    const needO = minEmptiesToWin('O');
    const leftX = movesLeftFor('X');
    const leftO = movesLeftFor('O');
    const softBudget = (needX > leftX + 1) && (needO > leftO + 1);
    const sx = openSegmentsStats('X');
    const so = openSegmentsStats('O');
    const lowThreats = (sx.bestSymbols <= 2 && so.bestSymbols <= 2 && E <= 12);
    const fewOpen = (sx.countOpen <= 2 && so.countOpen <= 2 && E <= 14);
    return softBudget || lowThreats || fewOpen;
  }

  // ======= AI =======
  function makeAIMove() {
    if (gameOver) return;
    const d = diffSel.value;
    let m = null;
    if (d === 'easy') m = getEasy();
    else if (d === 'medium') m = getMedium();
    else m = getHardMove();
    if (m) {
      setTimeout(() => { makeMove(m.x, m.y, 'O'); if (!gameOver) { current = 'X'; updateStatus(); } }, 330);
    }
  }

  function getEasy() {
    const w = findWinMove('O'); if (w) return w;
    const b = findWinMove('X'); if (b) return b;
    const xs = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (board[y][x] === 'X') xs.push({ x, y });
    if (xs.length === 0 && board[5]?.[5] === '') return { x: 5, y: 5 };
    const adj = [], st = [-1, 0, 1];
    xs.forEach(m => st.forEach(dy => st.forEach(dx => {
      if (dx === 0 && dy === 0) return;
      const nx = m.x + dx, ny = m.y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny][nx] === '' && !adj.some(c => c.x === nx && c.y === ny)) adj.push({ x: nx, y: ny });
    })));
    if (adj.length) return adj[Math.floor(Math.random() * adj.length)];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (board[y][x] === '') return { x, y };
    return null;
  }
  function getMedium() { return findWinMove('O') || findWinMove('X') || getEasy(); }

  // Hard chain: win → block → fork → danger patterns → center → strategic
  function getHardMove() {
    const winMove = findWinMove('O'); if (winMove) return winMove;
    const block = findWinMove('X');   if (block)   return block;
    const fork = createFork();        if (fork)    return fork;
    const danger = blockPatterns();   if (danger)  return danger;
    const center = takeCenter();      if (center)  return center;
    return strategic();
  }

  function findWinMove(sym) {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== '') continue;
      board[y][x] = sym;
      const ok = checkWin(sym);
      board[y][x] = '';
      if (ok) return { x, y };
    }
    return null;
  }

  function createFork() {
    const dirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }], TH = 2;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== '') continue;
      board[y][x] = 'O';
      let paths = 0;
      for (const d of dirs) {
        let pot = 0;
        for (let i = 1; i < WIN; i++) {
          const nx = x + d.dx * i, ny = y + d.dy * i;
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) break;
          if (board[ny][nx] === 'O') pot++;
          else if (board[ny][nx] !== '') break;
        }
        for (let i = 1; i < WIN; i++) {
          const nx = x - d.dx * i, ny = y - d.dy * i;
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) break;
          if (board[ny][nx] === 'O') pot++;
          else if (board[ny][nx] !== '') break;
        }
        if (pot >= WIN - 1) paths++;
      }
      board[y][x] = '';
      if (paths >= TH) return { x, y };
    }
    return null;
  }

  function blockPatterns() {
    const patterns = [
      { pattern: ['X', 'X', 'X', 'X', ''], priority: 1000 },
      { pattern: ['', 'X', 'X', 'X', 'X'], priority: 1000 },
      { pattern: ['X', 'X', 'X', '', 'X'], priority: 900 },
      { pattern: ['X', 'X', '', 'X', 'X'], priority: 900 },
      { pattern: ['X', '', 'X', 'X', 'X'], priority: 900 },
      { pattern: ['', 'X', 'X', 'X', ''], priority: 800 },
      { pattern: ['', '', 'X', 'X', 'X'], priority: 700 },
      { pattern: ['X', 'X', 'X', '', ''], priority: 700 },
      { pattern: ['', 'X', 'X', '', ''], priority: 600 },
      { pattern: ['', '', 'X', 'X', ''], priority: 600 }
    ];
    let best = null, hi = 0;
    const dirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
    for (const { pattern, priority } of patterns) {
      if (priority < hi) continue;
      for (const d of dirs) {
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
          let ok = true, empties = [];
          for (let i = 0; i < pattern.length; i++) {
            const nx = x + d.dx * i, ny = y + d.dy * i;
            if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) { ok = false; break; }
            if (pattern[i] === '') {
              if (board[ny][nx] !== '') { ok = false; break; }
              empties.push({ x: nx, y: ny });
            } else if (board[ny][nx] !== pattern[i]) { ok = false; break; }
          }
          if (ok && empties.length) {
            if (priority > hi) { hi = priority; best = empties[0]; }
          }
        }
      }
    }
    return best;
  }

  function takeCenter() {
    const pad = 2, cands = [];
    for (let y = pad; y < SIZE - pad; y++)
      for (let x = pad; x < SIZE - pad; x++)
        if (board[y][x] === '') cands.push({ x, y });
    if (!cands.length) return null;
    let best = null, score = -1;
    for (const p of cands) {
      const s = scoreCenter(p.x, p.y);
      if (s > score) { score = s; best = p; }
    }
    return best;
  }
  function scoreCenter(x, y) {
    let s = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        if (board[ny][nx] === 'O') s += 3;
        if (board[ny][nx] === 'X') s += 1;
      }
    const dirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
    for (const d of dirs) {
      let pot = 0;
      for (let i = 1; i < WIN; i++) {
        const nx = x + d.dx * i, ny = y + d.dy * i;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) break;
        if (board[ny][nx] === '') pot++;
        else if (board[ny][nx] === 'O') pot += 2;
        else break;
      }
      for (let i = 1; i < WIN; i++) {
        const nx = x - d.dx * i, ny = y - d.dy * i;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) break;
        if (board[ny][nx] === '') pot++;
        else if (board[ny][nx] === 'O') pot += 2;
        else break;
      }
      s += pot;
    }
    return s;
  }

  function strategic() {
    let best = null, score = -Infinity;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== '') continue;
      board[y][x] = 'O'; const off = evalSym('O');
      board[y][x] = 'X'; const def = evalSym('X');
      board[y][x] = '';
      const sc = off + def;
      if (sc > score) { score = sc; best = { x, y }; }
    }
    return best;
  }
  function evalSym(sym) {
    let s = 0;
    const dirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) for (const d of dirs) {
      let cnt = 0, open = 0;
      let nx = x + d.dx, ny = y + d.dy;
      while (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && (board[ny][nx] === sym || board[ny][nx] === '')) {
        if (board[ny][nx] === sym) cnt++; else open++;
        nx += d.dx; ny += d.dy;
      }
      nx = x - d.dx; ny = y - d.dy;
      while (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && (board[ny][nx] === sym || board[ny][nx] === '')) {
        if (board[ny][nx] === sym) cnt++; else open++;
        nx -= d.dx; ny -= d.dy;
      }
      if (cnt >= WIN) s += 10000;
      else if (cnt === WIN - 1 && open > 0) s += 1000;
      else if (cnt === WIN - 2 && open >= 2) s += 100;
      else if (cnt >= 2) s += cnt * 5;
    }
    return s;
  }

  // ======= Persistence =======
  function saveState() {
    try { localStorage.setItem('connect5State', JSON.stringify({ board, current, gameOver })); } catch { }
  }
  function loadState() {
    try {
      const raw = localStorage.getItem('connect5State'); if (!raw) return false;
      const st = JSON.parse(raw); if (!st || !Array.isArray(st.board)) return false;
      board = st.board; current = st.current || 'X'; gameOver = !!st.gameOver;
      updateBoard(); updateStatus();
      return true;
    } catch { return false; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadState();
  });

  // ======= Controls =======
  diffSel.addEventListener('change', restart);
  resetBtn.addEventListener('click', restart);
  aiStartBtn.addEventListener('click', () => { botStartsNext = true; restart(); });

  segFriend.addEventListener('click', () => {
    mode = 'friend';
    segFriend.classList.add('active');
    segAI.classList.remove('active');
    restart();
  });
  segAI.addEventListener('click', () => {
    mode = 'computer';
    segAI.classList.add('active');
    segFriend.classList.remove('active');
    restart();
  });

  langSel.addEventListener('change', e => {
    lang = e.target.value;
    localStorage.setItem('xoLanguage', lang);
    updateTopTexts();
  });
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem('xoGameSound', soundOn);
    updateTopTexts();
    if (soundOn) playSound('MOVE');
  });

  function restart() {
    gameOver = false; winCells = []; moveCount = 0; thinkingEl.textContent = '';
    showBanner('', null);
    forcedDrawNotified = false; likelyDrawNotified = false;
    createBoard();
  }

  // ======= Init =======
  (function initLang() {
    const savedLang = localStorage.getItem('xoLanguage');
    const savedSound = localStorage.getItem('xoGameSound');
    if (savedLang) { lang = savedLang; langSel.value = lang; }
    if (savedSound !== null) soundOn = (savedSound === 'true');
    updateTopTexts();
  })();

  createBoard();
  mode = 'computer'; segAI.classList.add('active'); segFriend.classList.remove('active');
  updateStatus();
  loadState();

  // PWA shortcuts (?action=new, ?ai=1)
  (function handleShortcuts() {
    const p = new URLSearchParams(location.search); let used = false;
    if (p.get('action') === 'new') { restart(); used = true; }
    if (p.get('ai') === '1') { mode = 'computer'; segAI.classList.add('active'); segFriend.classList.remove('active'); botStartsNext = true; restart(); used = true; }
    if (used) history.replaceState({}, '', location.pathname);
  })();
});
