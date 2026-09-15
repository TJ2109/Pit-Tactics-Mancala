"""
Pit Tactics — Mancala AI opponent using Minimax + Alpha-Beta Pruning.
Backend: Flask. Frontend: HTML/CSS/JS (see templates/ and static/).

Board representation (14 pits, indices 0-13):
    0-5   : Player's 6 pits
    6     : Player's store
    7-12  : AI's 6 pits
    13    : AI's store

Layout on screen (top row is AI, reversed; bottom row is player, left-to-right):

      12  11  10   9   8   7
   13                          6
       0   1   2   3   4   5
"""

from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

PLAYER_PITS = range(0, 6)
PLAYER_STORE = 6
AI_PITS = range(7, 13)
AI_STORE = 13

# Difficulty -> minimax search depth. Higher = stronger but slower AI.
DIFFICULTY_DEPTHS = {
    "low": 2,
    "medium": 5,
    "high": 9,
}
DEFAULT_DIFFICULTY = "medium"
MODES = ("pva", "pvp")  # player-vs-AI, player-vs-player
DEFAULT_MODE = "pva"


def new_game(difficulty=DEFAULT_DIFFICULTY, mode=DEFAULT_MODE):
    if difficulty not in DIFFICULTY_DEPTHS:
        difficulty = DEFAULT_DIFFICULTY
    if mode not in MODES:
        mode = DEFAULT_MODE
    board = [4] * 14
    board[PLAYER_STORE] = 0
    board[AI_STORE] = 0
    return {
        "board": board,
        "turn": "player",   # "player" or "ai" (side keys stay the same in both modes)
        "winner": None,     # None, "player", "ai", or "draw"
        "message": "Your turn. Pick a pit.",
        "difficulty": difficulty,
        "mode": mode,        # "pva" = vs AI, "pvp" = two humans
        "ai_moves": [],
    }


game_state = new_game()


def opposite_pit(i):
    return 12 - i


def is_game_over(board):
    player_empty = all(board[i] == 0 for i in PLAYER_PITS)
    ai_empty = all(board[i] == 0 for i in AI_PITS)
    return player_empty or ai_empty


def finalize_board(board):
    """Sweep remaining seeds into stores when the game has ended."""
    board = board[:]
    board[PLAYER_STORE] += sum(board[i] for i in PLAYER_PITS)
    board[AI_STORE] += sum(board[i] for i in AI_PITS)
    for i in list(PLAYER_PITS) + list(AI_PITS):
        board[i] = 0
    return board


def sow(board, pit, side):
    """
    Apply a move: sow seeds from `pit` counter-clockwise, skipping the
    opponent's store. Returns (new_board, extra_turn, captured).
    """
    board = board[:]
    seeds = board[pit]
    board[pit] = 0
    idx = pit

    own_store = PLAYER_STORE if side == "player" else AI_STORE
    opp_store = AI_STORE if side == "player" else PLAYER_STORE

    while seeds > 0:
        idx = (idx + 1) % 14
        if idx == opp_store:
            continue  # skip opponent's store
        board[idx] += 1
        seeds -= 1

    extra_turn = (idx == own_store)

    captured = False
    own_pits = PLAYER_PITS if side == "player" else AI_PITS
    if idx != own_store and idx in own_pits and board[idx] == 1:
        opp_idx = opposite_pit(idx)
        if board[opp_idx] > 0:
            board[own_store] += board[opp_idx] + board[idx]
            board[opp_idx] = 0
            board[idx] = 0
            captured = True

    return board, extra_turn, captured


def valid_moves(board, side):
    pits = PLAYER_PITS if side == "player" else AI_PITS
    return [i for i in pits if board[i] > 0]


def evaluate(board):
    """Positive favors the AI, negative favors the player."""
    score = (board[AI_STORE] - board[PLAYER_STORE]) * 3
    score += sum(board[i] for i in AI_PITS) - sum(board[i] for i in PLAYER_PITS)
    return score


def minimax(board, depth, alpha, beta, maximizing):
    """maximizing == True means it's the AI's turn to move."""
    if depth == 0 or is_game_over(board):
        if is_game_over(board):
            board = finalize_board(board)
        return evaluate(board), None

    side = "ai" if maximizing else "player"
    moves = valid_moves(board, side)
    if not moves:
        return evaluate(board), None

    best_move = moves[0]

    if maximizing:
        best_val = float("-inf")
        for m in moves:
            nb, extra, _ = sow(board, m, "ai")
            val, _ = minimax(nb, depth - 1, alpha, beta, True if extra else False)
            if val > best_val:
                best_val = val
                best_move = m
            alpha = max(alpha, best_val)
            if beta <= alpha:
                break
        return best_val, best_move
    else:
        best_val = float("inf")
        for m in moves:
            nb, extra, _ = sow(board, m, "player")
            val, _ = minimax(nb, depth - 1, alpha, beta, False if extra else True)
            if val < best_val:
                best_val = val
                best_move = m
            beta = min(beta, best_val)
            if beta <= alpha:
                break
        return best_val, best_move


def side_label(state, side):
    """Human-facing name for a side, depending on the game mode."""
    mode = state.get("mode", DEFAULT_MODE)
    if side == "player":
        return "Player 1" if mode == "pvp" else "You"
    return "Player 2" if mode == "pvp" else "AI"


def check_winner(state):
    board = state["board"]
    if is_game_over(board):
        board = finalize_board(board)
        state["board"] = board
        mode = state.get("mode", DEFAULT_MODE)
        if board[PLAYER_STORE] > board[AI_STORE]:
            state["winner"] = "player"
            state["message"] = f"{side_label(state, 'player')} win!" if mode == "pvp" else "You win!"
        elif board[AI_STORE] > board[PLAYER_STORE]:
            state["winner"] = "ai"
            state["message"] = f"{side_label(state, 'ai')} wins!" if mode == "pvp" else "AI wins!"
        else:
            state["winner"] = "draw"
            state["message"] = "It's a draw!"
        return True
    return False


def ai_take_turn(state):
    """
    AI plays its full turn, including any chained extra turns.
    Records every individual pit it picks (with a snapshot of the board
    after that pick) in state["ai_moves"] so the frontend can reveal the
    turn step by step instead of just showing the final result.
    """
    state["ai_moves"] = []
    depth = DIFFICULTY_DEPTHS.get(state.get("difficulty"), DIFFICULTY_DEPTHS[DEFAULT_DIFFICULTY])
    while state["turn"] == "ai" and state["winner"] is None:
        _, move = minimax(state["board"], depth, float("-inf"), float("inf"), True)
        if move is None:
            break
        board, extra, captured = sow(state["board"], move, "ai")
        state["board"] = board

        game_over = check_winner(state)

        step_message = "AI got an extra turn!" if extra else "Your turn. Pick a pit."
        if captured:
            step_message = "AI captured your seeds!"
        if game_over:
            step_message = state["message"]

        state["ai_moves"].append({
            "pit": move,
            "board": board[:],
            "extra": extra,
            "captured": captured,
            "message": step_message,
        })

        if game_over:
            return
        if extra:
            state["message"] = "AI got an extra turn!"
            continue
        else:
            state["turn"] = "player"
            state["message"] = "Your turn. Pick a pit."
            return


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/state")
def state():
    return jsonify(game_state)


@app.route("/start", methods=["POST"])
def start():
    """Begin a brand new game at the chosen difficulty and mode."""
    global game_state
    data = request.get_json(silent=True) or {}
    difficulty = data.get("difficulty", DEFAULT_DIFFICULTY)
    mode = data.get("mode", DEFAULT_MODE)
    game_state = new_game(difficulty, mode)
    return jsonify(game_state)


@app.route("/reset", methods=["POST"])
def reset():
    """Retry: start a new game, keeping the same difficulty/mode as before."""
    global game_state
    data = request.get_json(silent=True) or {}
    difficulty = data.get("difficulty", game_state.get("difficulty", DEFAULT_DIFFICULTY))
    mode = data.get("mode", game_state.get("mode", DEFAULT_MODE))
    game_state = new_game(difficulty, mode)
    return jsonify(game_state)


@app.route("/move", methods=["POST"])
def move():
    global game_state
    data = request.get_json()
    pit = data.get("pit")
    mode = game_state.get("mode", DEFAULT_MODE)

    game_state["ai_moves"] = []
    game_state.pop("player_move_board", None)

    if game_state["winner"] is not None:
        return jsonify(game_state)

    current_side = game_state["turn"]  # whoever's turn it actually is
    side_pits = PLAYER_PITS if current_side == "player" else AI_PITS

    if pit not in side_pits or game_state["board"][pit] == 0:
        game_state["message"] = "Invalid move. Try again."
        return jsonify(game_state)

    board, extra, captured = sow(game_state["board"], pit, current_side)
    game_state["board"] = board
    # Snapshot right after this move, before any auto-played AI reply, so the
    # frontend can show it before animating the AI's turn (pva mode only).
    game_state["player_move_board"] = board[:]

    if check_winner(game_state):
        return jsonify(game_state)

    if extra:
        game_state["turn"] = current_side
        label = side_label(game_state, current_side)
        if mode == "pvp":
            game_state["message"] = f"{label} lands in the store — go again!"
        else:
            game_state["message"] = "You got an extra turn!" if current_side == "player" else "AI got an extra turn!"
    else:
        next_side = "ai" if current_side == "player" else "player"
        game_state["turn"] = next_side
        if mode == "pvp":
            game_state["message"] = f"{side_label(game_state, next_side)}'s turn. Pick a pit."
        else:
            game_state["message"] = "Your turn. Pick a pit." if next_side == "player" else "AI is thinking..."
        if mode == "pva" and next_side == "ai":
            ai_take_turn(game_state)

    return jsonify(game_state)


if __name__ == "__main__":
    app.run(debug=True)
