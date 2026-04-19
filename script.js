const SYMBOLS = {
  4: ['1', '2', '3', '4'],
  9: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  16: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16']
};

const BASE_SOLVED = {
  4: [
    ['1', '2', '3', '4'],
    ['3', '4', '1', '2'],
    ['2', '1', '4', '3'],
    ['4', '3', '2', '1']
  ],
  9: [
    ['5', '3', '4', '6', '7', '8', '9', '1', '2'],
    ['6', '7', '2', '1', '9', '5', '3', '4', '8'],
    ['1', '9', '8', '3', '4', '2', '5', '6', '7'],
    ['8', '5', '9', '7', '6', '1', '4', '2', '3'],
    ['4', '2', '6', '8', '5', '3', '7', '9', '1'],
    ['7', '1', '3', '9', '2', '4', '8', '5', '6'],
    ['9', '6', '1', '5', '3', '7', '2', '8', '4'],
    ['2', '8', '7', '4', '1', '9', '6', '3', '5'],
    ['3', '4', '5', '2', '8', '6', '1', '7', '9']
  ],
  16: Array.from({ length: 16 }, (_, r) =>
    Array.from(
      { length: 16 },
      (_, c) => SYMBOLS[16][(c + (r * 4 + Math.floor(r / 4)) % 16) % 16]
    )
  )
};

const state = {
  mode: 'manual',
  size: 9,
  difficulty: 'medium',
  puzzle: [],
  board: [],
  fixed: new Set(),
  solving: false,
  timerId: null,
  remainingSeconds: 0,
  gameStartedAt: null,
  elapsedBeforePause: 0,
  soundEnabled: true,
  soundPaused: false,
  usedAI: false,
  selected: null,
  currentUser: null, 
  xp: 0, // NEW: Track local XP
  customTimers: { easy: 15, medium: 25, hard: 45 }
};

const difficultyHoles = {
  easy: { 4: 5, 9: 35, 16: 90 },
  medium: { 4: 7, 9: 45, 16: 120 },
  hard: { 4: 9, 9: 55, 16: 150 }
};

// --- PHASE 1: LEVEL TITLES & THRESHOLDS ---
const LEVEL_RANKS = [
  { threshold: 0, title: 'Novice' },
  { threshold: 50, title: 'Beginner Solver' },
  { threshold: 150, title: 'Logic Knight' },
  { threshold: 300, title: 'Grid Master' },
  { threshold: 600, title: 'Sudoku Sage' },
  { threshold: 1200, title: 'Grandmaster' }
];

const $ = (id) => document.getElementById(id);

const message = (txt) => {
  $('message').textContent = txt;
};

const defaultTimers = { easy: 15, medium: 25, hard: 45 };

const motivationQuotes = [
  'Brilliant thinking! Every puzzle makes your brain stronger 🌟',
  'You are a puzzle hero! Keep shining 🧠',
  'Awesome focus! Great leaders solve step by step 🚀',
  'Fantastic job! Calm mind, sharp logic 🎯',
  'You did it! Small moves create big wins 🎉'
];

function currentTimerSeconds() {
  return (state.customTimers[state.difficulty] || defaultTimers[state.difficulty] || 25) * 60;
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatDuration(sec) {
  const total = Math.max(0, Number(sec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function playTick() {
  if (state.mode !== 'manual' || !state.soundEnabled || state.soundPaused) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 820;
    gain.gain.value = 0.015;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    // audio is optional
  }
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function resetGameClock() {
  state.elapsedBeforePause = 0;
  state.gameStartedAt = null;
}

function pauseGameClock() {
  if (!state.gameStartedAt) return;
  state.elapsedBeforePause += Math.floor((Date.now() - state.gameStartedAt) / 1000);
  state.gameStartedAt = null;
}

function resumeGameClock() {
  if (!state.gameStartedAt) state.gameStartedAt = Date.now();
}

function getElapsedSeconds() {
  let elapsed = Number(state.elapsedBeforePause || 0);
  if (state.gameStartedAt) {
    elapsed += Math.floor((Date.now() - state.gameStartedAt) / 1000);
  }
  return Math.max(0, elapsed);
}

function startManualTimer(resume = false) {
  stopTimer();
  if (state.mode !== 'manual') return;

  resumeGameClock();
  if (!resume || !state.remainingSeconds) {
    state.remainingSeconds = currentTimerSeconds();
  }

  $('countdown').textContent = formatTime(state.remainingSeconds);
  state.timerId = setInterval(() => {
    state.remainingSeconds -= 1;
    if (state.remainingSeconds < 0) {
      stopTimer();
      pauseGameClock();
      message('⏰ Time is up! Start a new puzzle.');
      return;
    }
    $('countdown').textContent = formatTime(state.remainingSeconds);
    playTick();
    saveProgress();
  }, 1000);
}

function showWinCelebration() {
  const quote = motivationQuotes[Math.floor(Math.random() * motivationQuotes.length)];
  $('winQuote').textContent = quote;
  $('winModal').classList.remove('hidden');
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach((p) => p.classList.add('hidden'));
  const page = document.getElementById(pageId);
  if (page) page.classList.remove('hidden');

  const lbIcon = $('leaderboardIcon');
  if (lbIcon) {
    if (pageId === 'homePage') lbIcon.classList.remove('hidden');
    else lbIcon.classList.add('hidden');
  }
}

function deepCopy(grid) {
  return grid.map((row) => [...row]);
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function permuteSolved(size) {
  const solved = deepCopy(BASE_SOLVED[size]);
  const symbols = SYMBOLS[size];
  const permutedSymbols = shuffleArray(symbols);
  const map = new Map(symbols.map((s, i) => [s, permutedSymbols[i]]));

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      solved[r][c] = map.get(solved[r][c]);
    }
  }
  return solved;
}

function generatePuzzle(size, difficulty) {
  const solved = permuteSolved(size);
  const puzzle = deepCopy(solved);
  const holes = difficultyHoles[difficulty][size];
  let attempts = 0;

  while (attempts < holes * 3) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    if (puzzle[r][c] !== '') puzzle[r][c] = '';
    if (puzzle.flat().filter((x) => x === '').length >= holes) break;
    attempts++;
  }

  if (!isSolvable(puzzle)) return generatePuzzle(size, difficulty);
  return puzzle;
}

function getBoxSize(n) {
  return Math.sqrt(n);
}

function isValid(board, row, col, value) {
  const n = board.length;
  for (let i = 0; i < n; i++) {
    if (i !== col && board[row][i] === value) return false;
    if (i !== row && board[i][col] === value) return false;
  }

  const box = getBoxSize(n);
  const br = Math.floor(row / box) * box;
  const bc = Math.floor(col / box) * box;

  for (let r = br; r < br + box; r++) {
    for (let c = bc; c < bc + box; c++) {
      if ((r !== row || c !== col) && board[r][c] === value) return false;
    }
  }
  return true;
}

function getCandidates(board, row, col) {
  if (board[row][col] !== '') return [];
  const symbols = SYMBOLS[board.length];
  return symbols.filter((v) => isValid(board, row, col, v));
}

function selectMRV(board) {
  let best = null;
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board.length; c++) {
      if (board[r][c] !== '') continue;
      const cand = getCandidates(board, r, c);
      if (cand.length === 0) return { row: r, col: c, cand };
      if (!best || cand.length < best.cand.length) best = { row: r, col: c, cand };
      if (best && best.cand.length === 1) return best;
    }
  }
  return best;
}

function solveCSP(board) {
  const target = selectMRV(board);
  if (!target) return true;
  const { row, col, cand } = target;

  for (const v of cand) {
    board[row][col] = v;
    if (solveCSP(board)) return true;
    board[row][col] = '';
  }
  return false;
}

function isSolvable(puzzle) {
  const copy = deepCopy(puzzle);
  return solveCSP(copy);
}

function updateHighlights(r, c) {
  state.selected = { r, c };
  const n = state.size;
  const val = state.board[r][c];
  const box = getBoxSize(n);
  const br = Math.floor(r / box) * box;
  const bc = Math.floor(c / box) * box;

  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, idx) => {
    cell.classList.remove('selected', 'highlight-peer', 'highlight-match');
    const i = Math.floor(idx / n);
    const j = idx % n;

    if (val !== '' && state.board[i][j] === val) {
      cell.classList.add('highlight-match');
    } else if (i === r && j === c) {
      cell.classList.add('selected');
    } else if (i === r || j === c || (i >= br && i < br + box && j >= bc && j < bc + box)) {
      cell.classList.add('highlight-peer');
    }
  });
}

function renderGrid() {
  const n = state.size;
  const grid = $('gridContainer');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  grid.classList.remove('size-4', 'size-9', 'size-16');
  grid.classList.add(`size-${n}`);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const box = getBoxSize(n);
      if ((c + 1) % box === 0 && c !== n - 1) cell.style.borderRight = '3px solid var(--line)';
      if ((r + 1) % box === 0 && r !== n - 1) cell.style.borderBottom = '3px solid var(--line)';

      const input = document.createElement('input');
      input.setAttribute('data-r', r);
      input.setAttribute('data-c', c);
      input.maxLength = n === 16 ? 2 : 1;
      input.value = state.board[r][c];

      if (state.fixed.has(`${r},${c}`)) {
        input.disabled = true;
        cell.classList.add('fixed');
      }

      input.addEventListener('input', (e) => onInput(e, r, c));
      input.addEventListener('focus', () => {
        if (typeof updateHighlights === 'function') updateHighlights(r, c);
      });

      input.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault(); 
          let nextR = r;
          let nextC = c;

          if (e.key === 'ArrowUp') nextR = (r - 1 + n) % n;
          if (e.key === 'ArrowDown') nextR = (r + 1) % n;
          if (e.key === 'ArrowLeft') nextC = (c - 1 + n) % n;
          if (e.key === 'ArrowRight') nextC = (c + 1) % n;

          const nextInput = document.querySelector(`input[data-r="${nextR}"][data-c="${nextC}"]`);
          if (nextInput) {
            nextInput.focus();
            setTimeout(() => {
              nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
            }, 0);
          }
        }
      });

      cell.appendChild(input);
      grid.appendChild(cell);
    }
  }

  if (state.selected) {
    updateHighlights(state.selected.r, state.selected.c);
  }
}

function onInput(e, r, c) {
  if (state.mode === 'manual' && !state.gameStartedAt) {
    resumeGameClock();
  }

  const raw = e.target.value.trim();
  const allowed = SYMBOLS[state.size];

  if (!allowed.includes(raw)) {
    e.target.value = '';
    state.board[r][c] = '';
    if (typeof updateHighlights === 'function') updateHighlights(r, c);
    saveProgress();
    return;
  }

  state.board[r][c] = raw;
  e.target.value = raw;

  const parent = e.target.parentElement;
  if (!isValid(state.board, r, c, raw)) {
    parent.classList.add('error');
    message('Invalid move.');
  } else {
    parent.classList.remove('error');
    message('');
  }

  if (typeof updateHighlights === 'function') updateHighlights(r, c);
  saveProgress();
  
  checkWin(true); 
}

function setGame(puzzle) {
  state.puzzle = deepCopy(puzzle);
  state.board = deepCopy(puzzle);
  state.fixed = new Set();
  state.selected = null;

  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.puzzle[r][c] !== '') state.fixed.add(`${r},${c}`);
    }
  }

  $('sizeLabel').textContent = `${state.size}×${state.size}`;
  $('modeLabel').textContent = state.mode === 'manual' ? 'Manual' : 'AI';
  $('countdown').textContent = formatTime(currentTimerSeconds());
  renderGrid();
}

function startNewGame() {
  const puzzle = generatePuzzle(state.size, state.difficulty);
  state.usedAI = false;
  setGame(puzzle);

  resetGameClock();
  stopTimer();
  state.remainingSeconds = currentTimerSeconds();
  $('countdown').textContent = formatTime(state.remainingSeconds);
  message('New game ready. Press Start when ready.');
  saveProgress();
}

async function solveWithTime(animated = false) {
  if (state.solving) return;
  state.solving = true;
  state.usedAI = true;

  let working = deepCopy(state.board);
  const t0 = performance.now();
  let solved = solveCSP(working);
  let exactMs = ((performance.now() - t0) / 1000).toFixed(3);

  if (!solved) {
    working = deepCopy(state.puzzle);
    solved = solveCSP(working);
    exactMs = ((performance.now() - t0) / 1000).toFixed(3);
    message(`AI Auto-Solved in ${exactMs}s! (Mistakes in your progress were corrected)`);
  } else {
    message(`AI Auto-Solved remaining cells in ${exactMs}s! (This speed is not saved)`);
  }

  $('aiTime').textContent = `${exactMs}s`;

  if (animated) {
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (!state.fixed.has(`${r},${c}`)) {
          state.board[r][c] = working[r][c];
          renderGrid();
          await new Promise((res) => setTimeout(res, 10));
        }
      }
    }
  } else {
    state.board = working;
    renderGrid();
  }

  stopTimer();
  pauseGameClock();
  state.solving = false;
}

function provideHint() {
  if (state.mode !== 'manual') {
    message('Hints are only available in Manual mode.');
    return;
  }

  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.board[r][c] === '') {
        const cand = getCandidates(state.board, r, c);
        if (cand.length === 1) {
          const val = cand[0];
          state.board[r][c] = val;
          renderGrid();
          updateHighlights(r, c);
          state.usedAI = true;
          message(`💡 Hint: Row ${r + 1}, Col ${c + 1} must be ${val}. Only valid candidate.`);
          saveProgress();
          checkWin(true); 
          return;
        }
      }
    }
  }

  const working = deepCopy(state.board);
  if (!solveCSP(working)) {
    message('No solution possible from current state.');
    return;
  }

  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.board[r][c] === '') {
        const correctVal = working[r][c];
        state.board[r][c] = correctVal;
        renderGrid();
        updateHighlights(r, c);
        state.usedAI = true;
        message(`💡 AI Hint: ${correctVal} fits at Row ${r + 1}, Col ${c + 1}.`);
        saveProgress();
        checkWin(true); 
        return;
      }
    }
  }
  message('Board already complete!');
}

function checkWin(silent = false) {
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      const val = state.board[r][c];
      if (!val || !isValid(state.board, r, c, val)) {
        if (!silent) message('Not solved yet.');
        return;
      }
    }
  }

  const elapsedSec = Math.max(1, getElapsedSeconds());
  stopTimer();
  pauseGameClock();
  updateStreak();
  showWinCelebration();

  let username = state.currentUser;
  
  if (!username) {
    message('Puzzle Solved! Log in to save your score to the leaderboard.');
    return;
  }
  
  message('Great job! Puzzle solved.');
  const region = $('regionInput')?.value?.trim() || 'Global';
  const maxTime = currentTimerSeconds();
  const score = Math.max(1, Math.min(100, Math.round(((maxTime - elapsedSec) / maxTime) * 100)));

  if (state.usedAI) {
    username += ' 🤖 (AI)';
  }

  // Pass usedAI flag to server so it can calculate XP correctly
  saveScore(username, score, state.difficulty, state.size, region, elapsedSec, state.usedAI);
}

function updateStreak() {
  const key = 'sudoku_streak';
  const dateKey = 'sudoku_last_solve';
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(dateKey);

  let streak = Number(localStorage.getItem(key) || 0);
  if (last !== today) streak += 1;

  localStorage.setItem(key, String(streak));
  localStorage.setItem(dateKey, today);
  $('streakCount').textContent = streak;
}

function hydrateStreak() {
  $('streakCount').textContent = Number(localStorage.getItem('sudoku_streak') || 0);
}

// --- PHASE 1: XP UI UPDATE FUNCTION ---
function renderXP(totalXP) {
  state.xp = totalXP;
  let currentLvl = LEVEL_RANKS[0];
  let nextLvl = LEVEL_RANKS[1];

  // Find the player's correct rank bracket
  for (let i = 0; i < LEVEL_RANKS.length; i++) {
    if (totalXP >= LEVEL_RANKS[i].threshold) {
      currentLvl = LEVEL_RANKS[i];
      nextLvl = LEVEL_RANKS[i + 1] || LEVEL_RANKS[i];
    } else {
      break;
    }
  }

  $('levelTitle').textContent = currentLvl.title;
  $('playerProgression').classList.remove('hidden');

  // Calculate percentage to fill the bar
  if (currentLvl === nextLvl) {
    // Max Level Reached
    $('xpText').textContent = `${totalXP} XP (MAX)`;
    $('xpBarFill').style.width = `100%`;
  } else {
    const xpIntoLevel = totalXP - currentLvl.threshold;
    const xpNeeded = nextLvl.threshold - currentLvl.threshold;
    const percentage = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));
    
    $('xpText').textContent = `${totalXP} / ${nextLvl.threshold} XP`;
    $('xpBarFill').style.width = `${percentage}%`;
  }
}

async function saveScore(username, score, difficulty, size, region, timeSeconds = 0, usedAI = false) {
  try {
    const response = await fetch('/save_score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, score, difficulty, size, region, timeSeconds, usedAI })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // UPDATE XP BAR IF SERVER SENDS NEW XP!
    if (data.new_xp !== undefined && state.currentUser) {
      renderXP(data.new_xp);
      message(`Score saved! You earned XP!`);
    }

    await loadLeaderboard(); 
  } catch (error) {
    console.error("Save Score Error:", error);
    message('Could not save score to leaderboard.');
  }
}

async function loadLeaderboard() {
  try {
    const resp = await fetch('/leaderboard');
    const data = await resp.json();

    const list = $('leaderboardList');
    if (list) {
      list.innerHTML = data
        .map(
          (x) =>
            `<li style="margin-bottom: 0.5rem; line-height: 1.4;">
              <strong>${x.username || 'Guest'}</strong><br>
              <span style="font-size: 0.85em; opacity: 0.8;">${(x.difficulty || 'medium').toUpperCase()} [${x.size}×${x.size}] — ${x.score} pts • ${formatDuration(x.time_seconds)} (${x.region || 'Global'})</span>
            </li>`
        )
        .join('');
    }

    const body = $('leaderboardTableBody');
    if (body) {
      body.innerHTML = data
        .map(
          (x) =>
            `<tr>
              <td style="font-weight: 600;">${x.username || 'Guest'}</td>
              <td style="text-transform: capitalize;">${x.difficulty || 'medium'}</td>
              <td>${x.size || 9}×${x.size || 9}</td>
              <td>${x.score}</td>
              <td>${x.region || 'Global'}</td>
              <td>${formatDuration(x.time_seconds)}</td>
            </tr>`
        )
        .join('');
    }
  } catch (err) {
    console.error("Leaderboard Error:", err);
    const list = $('leaderboardList');
    if (list) list.innerHTML = '<li>Leaderboard unavailable.</li>';
  }
}

async function loadDaily() {
  try {
    const resp = await fetch(`/daily?size=${state.size}`);
    const payload = await resp.json();

    if (payload?.puzzle?.length) {
      setGame(payload.puzzle);
      resetGameClock();
      stopTimer();
      state.remainingSeconds = currentTimerSeconds();
      $('countdown').textContent = formatTime(state.remainingSeconds);

      const options = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      const localDate = new Date().toLocaleDateString('en-IN', options);

      $('dailyStatus').textContent = `Ready (${localDate})`;
      showPage('gamePage');

      const bp = $('gameBoardPanel');
      bp.classList.remove('board-pop');
      void bp.offsetWidth;
      bp.classList.add('board-pop');

      message('Daily challenge loaded.');
      saveProgress();
    }
  } catch {
    message('Daily challenge unavailable.');
  }
}

function saveProgress() {
  const payload = {
    mode: state.mode,
    size: state.size,
    difficulty: state.difficulty,
    puzzle: state.puzzle,
    board: state.board,
    aiTime: $('aiTime').textContent,
    countdown: $('countdown').textContent,
    gameStartedAt: state.gameStartedAt,
    elapsedBeforePause: state.elapsedBeforePause,
    usedAI: state.usedAI,
    selected: state.selected
  };
  localStorage.setItem('sudoku_progress', JSON.stringify(payload));
}

function resumeProgress() {
  const raw = localStorage.getItem('sudoku_progress');
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);

    state.mode = data.mode || 'manual';
    state.size = Number(data.size || 9);
    state.difficulty = data.difficulty || 'medium';
    state.usedAI = data.usedAI || false;
    state.selected = data.selected || null;

    $('modeSelect').value = state.mode;
    $('sizeSelect').value = String(state.size);
    $('difficultySelect').value = state.difficulty;

    setGame(data.puzzle?.length ? data.puzzle : generatePuzzle(state.size, state.difficulty));
    state.board = data.board?.length ? data.board : state.board;
    state.selected = data.selected || null;

    renderGrid();

    $('aiTime').textContent = data.aiTime || '0.000s';

    const sec = (data.countdown || formatTime(currentTimerSeconds())).split(':');
    state.remainingSeconds = Number(sec[0] || 0) * 60 + Number(sec[1] || 0);
    state.elapsedBeforePause = Number(data.elapsedBeforePause || 0);
    state.gameStartedAt = data.gameStartedAt ? Number(data.gameStartedAt) : null;

    $('countdown').textContent = formatTime(state.remainingSeconds || currentTimerSeconds());
    showPage('gamePage');
    message('Resumed previous game.');
    return true;
  } catch {
    return false;
  }
}

function bindSidebar() {
  const menu = $('sideBar');

  $('menuToggle').addEventListener('click', () => {
    menu.classList.toggle('open');
    document.body.classList.toggle('menu-open', menu.classList.contains('open'));
  });

  $('closeMenu').addEventListener('click', () => {
    menu.classList.remove('open');
    document.body.classList.remove('menu-open');
  });

  menu.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      showPage(btn.dataset.page);
      menu.classList.remove('open');
      document.body.classList.remove('menu-open');
    });
  });

  $('leaderboardIcon').addEventListener('click', () => showPage('leaderboardPage'));
}

async function verifySession() {
  try {
    const res = await fetch('/check_auth');
    const data = await res.json();
    if (data.logged_in) {
      state.currentUser = data.username;
      $('openLoginBtn').classList.add('hidden');
      $('loggedInDisplay').textContent = data.username;
      $('loggedInDisplay').classList.remove('hidden');
      $('logoutBtn').classList.remove('hidden');
      // Load their XP into the bar!
      renderXP(data.xp);
    }
  } catch (e) { console.log("Auth offline."); }
}

async function handleAuth(endpoint) {
  const user = $('authUsername').value.trim();
  const pass = $('authPassword').value;
  const errText = $('authError');
  errText.textContent = '';

  if (!user || !pass) {
    errText.textContent = 'Please fill all fields.';
    return;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    });
    const data = await res.json();

    if (res.ok) {
      state.currentUser = data.username;
      $('openLoginBtn').classList.add('hidden');
      $('loggedInDisplay').textContent = data.username;
      $('loggedInDisplay').classList.remove('hidden');
      $('logoutBtn').classList.remove('hidden');
      
      $('authModal').classList.add('hidden');
      $('authUsername').value = '';
      $('authPassword').value = '';
      
      // Show their XP bar immediately after login!
      renderXP(data.xp || 0);
      message(`Welcome, ${data.username}!`);
    } else {
      errText.textContent = data.error || 'Authentication failed.';
    }
  } catch (e) {
    errText.textContent = 'Server connection error.';
  }
}

function bindUI() {
  $('newBtn').addEventListener('click', startNewGame);
  $('shuffleBtn').addEventListener('click', startNewGame);
  
  $('checkBtn').addEventListener('click', (e) => {
      e.preventDefault();
      checkWin(false);
  });
  
  $('solveBtn').addEventListener('click', () => solveWithTime(state.mode === 'ai'));
  $('hintBtn').addEventListener('click', provideHint);
  $('dailyBtn').addEventListener('click', loadDaily);
  $('closeWinModal').addEventListener('click', () => $('winModal').classList.add('hidden'));

  $('startBtn').addEventListener('click', () => {
    if (state.mode === 'manual') startManualTimer(true);
  });

  $('pauseBtn').addEventListener('click', () => {
    stopTimer();
    pauseGameClock();
    message('Game paused.');
    saveProgress();
  });

  $('openLoginBtn').addEventListener('click', () => $('authModal').classList.remove('hidden'));
  $('closeAuthModal').addEventListener('click', () => {
    $('authModal').classList.add('hidden');
    $('authError').textContent = '';
  });
  $('loginSubmitBtn').addEventListener('click', () => handleAuth('/login'));
  $('registerSubmitBtn').addEventListener('click', () => handleAuth('/register'));
  
  $('logoutBtn').addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST' });
    state.currentUser = null;
    $('openLoginBtn').classList.remove('hidden');
    $('loggedInDisplay').classList.add('hidden');
    $('logoutBtn').classList.add('hidden');
    // Hide the XP bar when they log out
    $('playerProgression').classList.add('hidden');
    message('Logged out successfully.');
  });

  $('settingSound').addEventListener('change', (e) => {
    state.soundEnabled = e.target.checked;
    state.soundPaused = !state.soundEnabled;
    localStorage.setItem('sudoku_sound', state.soundEnabled ? 'on' : 'off');
  });

  $('settingDark').addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
    $('themeToggle').checked = e.target.checked;
    localStorage.setItem('sudoku_theme', e.target.checked ? 'dark' : 'light');
  });

  $('saveTimerBtn').addEventListener('click', () => {
    state.customTimers.easy = Math.max(1, Number($('timerEasy').value || 15));
    state.customTimers.medium = Math.max(1, Number($('timerMedium').value || 25));
    state.customTimers.hard = Math.max(1, Number($('timerHard').value || 45));

    localStorage.setItem('sudoku_custom_timers', JSON.stringify(state.customTimers));

    if (state.mode === 'manual' && !state.timerId) {
      $('countdown').textContent = formatTime(state.remainingSeconds || currentTimerSeconds());
    }
    message('Custom timers saved.');
  });

  $('resumeBtn').addEventListener('click', () => {
    if (!resumeProgress()) message('No saved game found.');
  });

  $('restartBtn').addEventListener('click', () => {
    localStorage.removeItem('sudoku_progress');
    startNewGame();
    showPage('gamePage');
  });

  $('modeSelect').addEventListener('change', (e) => {
    state.mode = e.target.value;
    $('modeLabel').textContent = state.mode === 'manual' ? 'Manual' : 'AI';

    if (state.mode === 'manual') {
      $('countdown').textContent = formatTime(state.remainingSeconds || currentTimerSeconds());
      stopTimer();
    } else {
      stopTimer();
      pauseGameClock();
      $('countdown').textContent = '--:--';
    }
    message(`Mode switched to ${state.mode.toUpperCase()}.`);
  });

  $('sizeSelect').addEventListener('change', (e) => {
    state.size = Number(e.target.value);
    startNewGame();
  });

  $('difficultySelect').addEventListener('change', (e) => {
    state.difficulty = e.target.value;
    startNewGame();
  });

  $('themeToggle').addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
    $('settingDark').checked = e.target.checked;
    localStorage.setItem('sudoku_theme', e.target.checked ? 'dark' : 'light');
  });

  const screen = $('loadingScreen');
  const enter = () => {
    screen.classList.add('hidden');
    $('app').classList.remove('hidden');
    showPage('homePage');
    $('sideBar').classList.remove('open');
    document.body.classList.remove('menu-open');
    
    const lbPanel = $('leaderboardPanel');
    if (lbPanel) lbPanel.classList.add('hidden');
  };

  screen.querySelector('.poster').addEventListener('click', enter);
  screen.querySelector('.poster').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') enter();
  });
}

function initTheme() {
  const saved = localStorage.getItem('sudoku_theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
    $('themeToggle').checked = true;
    $('settingDark').checked = true;
  }

  const savedTimers = localStorage.getItem('sudoku_custom_timers');
  if (savedTimers) {
    try {
      state.customTimers = { ...state.customTimers, ...JSON.parse(savedTimers) };
    } catch {
      // ignore invalid timer config
    }
  }

  $('timerEasy').value = state.customTimers.easy;
  $('timerMedium').value = state.customTimers.medium;
  $('timerHard').value = state.customTimers.hard;

  const sound = localStorage.getItem('sudoku_sound');
  if (sound === 'off') {
    state.soundEnabled = false;
    state.soundPaused = true;
    $('settingSound').checked = false;
  }
}

function init() {
  verifySession();
  bindSidebar();
  bindUI();
  hydrateStreak();
  initTheme();
  showPage('homePage');
  startNewGame();
  loadLeaderboard();
}

window.addEventListener('DOMContentLoaded', init);
