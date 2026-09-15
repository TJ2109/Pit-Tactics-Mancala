const screens = {
  welcome: document.getElementById("screen-welcome"),
  howto: document.getElementById("screen-howto"),
  mode: document.getElementById("screen-mode"),
  difficulty: document.getElementById("screen-difficulty"),
  game: document.getElementById("screen-game"),
};
const overlayEnd = document.getElementById("overlay-end");

const messageEl = document.getElementById("message");
const difficultyBadge = document.getElementById("difficulty-badge");
const playerPits = document.querySelectorAll(".player-pit");
const aiPits = document.querySelectorAll(".ai-pit");
const storeLabelBottom = document.getElementById("store-6-label");
const storeLabelTop = document.getElementById("store-13-label");

const btnWelcomeStart = document.getElementById("btn-welcome-start");
const btnHowtoBack = document.getElementById("btn-howto-back");
const btnHowtoContinue = document.getElementById("btn-howto-continue");
const btnModeBack = document.getElementById("btn-mode-back");
const btnModePva = document.getElementById("btn-mode-pva");
const btnModePvp = document.getElementById("btn-mode-pvp");
const btnDifficultyBack = document.getElementById("btn-difficulty-back");
const difficultyButtons = document.querySelectorAll(".btn-difficulty[data-difficulty]");
const btnQuit = document.getElementById("btn-quit");
const btnRetry = document.getElementById("btn-retry");
const btnEnd = document.getElementById("btn-end");

const endTitle = document.getElementById("end-title");
const endMessage = document.getElementById("end-message");

let currentDifficulty = "medium";
let currentMode = "pva";
let currentBoardState = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function showEndOverlay(state) {
  let title = "Game Over";
  if (state.winner === "draw") {
    title = "It's a Draw";
  } else if (state.mode === "pvp") {
    title = state.winner === "player" ? "Player 1 Wins!" : "Player 2 Wins!";
  } else {
    title = state.winner === "player" ? "You Win!" : "AI Wins";
  }
  endTitle.textContent = title;
  const label1 = state.mode === "pvp" ? "Player 1" : "You";
  const label2 = state.mode === "pvp" ? "Player 2" : "AI";
  endMessage.textContent = `Final score — ${label1}: ${state.board[6]}  ·  ${label2}: ${state.board[13]}`;
  overlayEnd.classList.add("active");
}

function hideEndOverlay() {
  overlayEnd.classList.remove("active");
}

function renderSeedCluster(container, count) {
  container.innerHTML = "";
  const maxRadius = 36;
  for (let i = 0; i < count; i++) {
    const angle = i * 137.508 * (Math.PI / 180);
    const radius = maxRadius * Math.sqrt((i + 0.5) / Math.max(count, 1));
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle) * 0.62;
    const dot = document.createElement("span");
    dot.className = "seed-dot" + (i % 3 === 0 ? " seed-dot-light" : "");
    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    container.appendChild(dot);
  }
}

function renderBoard(board) {
  board.forEach((count, i) => {
    if (i === 6 || i === 13) {
      const totalEl = document.getElementById(`pit-${i}`);
      if (totalEl) totalEl.textContent = count;
      return;
    }
    const cluster = document.getElementById(`pit-${i}`);
    const numberEl = document.getElementById(`pit-num-${i}`);
    if (numberEl) numberEl.textContent = count;
    if (cluster) {
      renderSeedCluster(cluster, count);
      cluster.closest(".pit").classList.toggle("empty", count === 0);
    }
  });
}

function updatePitInteractivity(state) {
  const pvp = state.mode === "pvp";
  const winner = state.winner !== null;

  playerPits.forEach((pit) => {
    const enabled = !winner && state.turn === "player";
    pit.style.pointerEvents = enabled ? "auto" : "none";
    pit.style.opacity = enabled ? "1" : "0.7";
  });

  aiPits.forEach((pit) => {
    const enabled = !winner && pvp && state.turn === "ai";
    pit.style.pointerEvents = enabled ? "auto" : "none";
    pit.style.cursor = enabled ? "pointer" : "default";
    pit.style.opacity = enabled ? "1" : (pvp ? "0.7" : "0.95");
  });
}

function applyModeLabels(mode) {
  storeLabelBottom.textContent = mode === "pvp" ? "Player 1" : "You";
  storeLabelTop.textContent = mode === "pvp" ? "Player 2" : "AI";
}

function renderState(state) {
  currentBoardState = [...state.board];
  renderBoard(state.board);
  messageEl.textContent = state.message;
  updatePitInteractivity(state);

  if (state.winner) {
    showEndOverlay(state);
  } else {
    hideEndOverlay();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simulates seed dropping pit-by-pit counter-clockwise
async function animateSowing(startPit, startBoard, side) {
  const tempBoard = [...startBoard];
  let seeds = tempBoard[startPit];
  tempBoard[startPit] = 0;
  renderBoard(tempBoard);

  let idx = startPit;
  const oppStore = side === "player" ? 13 : 6;

  while (seeds > 0) {
    idx = (idx + 1) % 14;
    if (idx === oppStore) continue;

    tempBoard[idx]++;
    seeds--;

    const pitEl = document.querySelector(`.pit[data-pit="${idx}"]`) || document.getElementById(`store-${idx}`);
    if (pitEl) pitEl.classList.add("ai-active");

    renderBoard(tempBoard);
    await sleep(2000); // Speed of dropping each seed (slow motion)

    if (pitEl) pitEl.classList.remove("ai-active");
  }
}

async function animateAiTurn(aiMoves, initialBoard) {
  let currentBoardSnapshot = [...initialBoard];

  for (const step of aiMoves) {
    const pitDiv = document.querySelector(`.pit[data-pit="${step.pit}"]`);
    if (pitDiv) pitDiv.classList.add("ai-active");

    const displayPitNumber = 13 - step.pit;
    messageEl.textContent = `AI picked Pit ${displayPitNumber}...`;
    await sleep(2000); // Time to read AI choice

    if (pitDiv) pitDiv.classList.remove("ai-active");

    await animateSowing(step.pit, currentBoardSnapshot, "ai");
    currentBoardSnapshot = [...step.board];

    renderBoard(step.board);
    if (step.captured) {
      messageEl.textContent = "AI captured your seeds!";
    } else if (step.extra) {
      messageEl.textContent = "AI landed in its store — extra turn!";
    } else {
      messageEl.textContent = step.message;
    }

    await sleep(2000); // Time to view outcome of the turn step
  }
}

async function startGame(difficulty, mode) {
  currentDifficulty = difficulty;
  currentMode = mode;
  applyModeLabels(mode);
  difficultyBadge.textContent = mode === "pvp"
    ? "Player vs Player"
    : `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} AI`;
  hideEndOverlay();
  showScreen("game");
  messageEl.textContent = "Setting up the board...";
  const res = await fetch("/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficulty, mode }),
  });
  const state = await res.json();
  renderState(state);
}

async function makeMove(pit) {
  playerPits.forEach((p) => (p.style.pointerEvents = "none"));
  aiPits.forEach((p) => (p.style.pointerEvents = "none"));

  const currentTurnSide = pit <= 5 ? "player" : "ai";

  // 1. Animate your own move dropping seeds one-by-one in slow motion
  await animateSowing(pit, currentBoardState, currentTurnSide);

  // 2. Process move with backend
  const res = await fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pit: pit }),
  });
  const state = await res.json();

  const preMoveBoard = state.player_move_board ? [...state.player_move_board] : [...state.board];

  if (state.player_move_board) {
    renderBoard(state.player_move_board);
  }

  // 3. Animate AI moves pit-by-pit if playing against AI
  if (state.ai_moves && state.ai_moves.length > 0) {
    await sleep(600);
    messageEl.textContent = "AI is thinking...";
    await animateAiTurn(state.ai_moves, preMoveBoard);
  }

  renderState(state);
}

async function retryGame() {
  hideEndOverlay();
  messageEl.textContent = "Setting up the board...";
  const res = await fetch("/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficulty: currentDifficulty, mode: currentMode }),
  });
  const state = await res.json();
  renderState(state);
}

// Navigation
btnWelcomeStart.addEventListener("click", () => showScreen("howto"));
btnHowtoBack.addEventListener("click", () => showScreen("welcome"));
btnHowtoContinue.addEventListener("click", () => showScreen("mode"));
btnModeBack.addEventListener("click", () => showScreen("howto"));
btnModePva.addEventListener("click", () => showScreen("difficulty"));
btnModePvp.addEventListener("click", () => startGame(currentDifficulty, "pvp"));
btnDifficultyBack.addEventListener("click", () => showScreen("mode"));

difficultyButtons.forEach((btn) => {
  btn.addEventListener("click", () => startGame(btn.dataset.difficulty, "pva"));
});

btnQuit.addEventListener("click", () => {
  hideEndOverlay();
  showScreen("welcome");
});

btnRetry.addEventListener("click", retryGame);

btnEnd.addEventListener("click", () => {
  hideEndOverlay();
  showScreen("welcome");
});

playerPits.forEach((pit) => {
  pit.addEventListener("click", () => {
    const idx = parseInt(pit.dataset.pit, 10);
    makeMove(idx);
  });
});

aiPits.forEach((pit) => {
  pit.addEventListener("click", () => {
    const idx = parseInt(pit.dataset.pit, 10);
    makeMove(idx);
  });
});