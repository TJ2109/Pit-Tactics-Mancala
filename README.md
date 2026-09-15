# Pit Tactics — Mancala vs AI (Flask + HTML/CSS/JS)

## Setup
pip install flask
python app.py

Then open http://127.0.0.1:5000 in your browser.

## Flow
1. **Welcome screen** — title + "Start" button.
2. **How to Play** — rules diagram and steps.
3. **Mode screen** — Player vs AI, or Player vs Player.
4. **Difficulty screen** (Player vs AI only) — Low / Medium / High, sets the
   AI's minimax search depth (2 / 5 / 9).
5. **Game screen** — play. In Player vs Player, both rows of pits are
   clickable depending on whose turn it is; no AI is involved.
6. **End overlay** — appears automatically when the game ends, with
   "Retry" (new game, same settings) and "End Game" (back to the
   welcome screen) buttons.

## Project structure
- `app.py` — Flask backend. Holds game state in memory, implements
  Mancala (Kalah) rules (sowing, extra turns, captures), an AI opponent
  using minimax with alpha-beta pruning, and a `mode` field ("pva" or
  "pvp") that turns the AI on or off. `DIFFICULTY_DEPTHS` controls how
  deep the AI searches per difficulty.
- `templates/index.html` — all four screens (welcome, difficulty, game,
  end overlay) live in one page; JS toggles which is visible.
- `static/style.css` — styling for the wooden board and menu screens.
- `static/script.js` — screen navigation plus fetch() calls to the
  backend.

## Endpoints
- `GET  /`      → renders the page
- `GET  /state` → current game state as JSON
- `POST /start` → body `{"difficulty": "low"|"medium"|"high", "mode": "pva"|"pvp"}`,
  begins a brand-new game
- `POST /move`  → body `{"pit": <0-12, excluding stores>}`, plays a move for
  whichever side's turn it currently is
- `POST /reset` → body `{"difficulty": ..., "mode": ...}` (both optional,
  default to the current game's settings), used by "Retry"
