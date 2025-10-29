## Zork-Like House Mystery API

This project exposes a small FastAPI application that lets you play a turn-based, session-based text adventure inspired by Zork. Explore a family estate, recover the missing ledger, and return it to the foyer to win the game and post a score.

### Requirements

- Python 3.11 or newer (the project targets 3.14, but FastAPI currently works with 3.11+).
- `uv` for dependency management and running the service.

### Installation

```bash
uv sync
```

### Running the API

```bash
uv run uvicorn main:app --reload --port 8005
```

The server defaults to `http://127.0.0.1:8005`. An OpenAPI schema and interactive docs are available at `/docs`.

### Core Endpoints

- `POST /sessions` — start a new session by providing a `player_name`. Returns the session ID plus the initial game state.
- `GET /sessions/{session_id}` — fetch the current game state for an existing session.
- `GET /sessions/{session_id}/actions` — list the currently valid command phrases for the session.
- `POST /sessions/{session_id}/actions` — perform a turn-based action. Supported actions include `look`, `go`, `pick up`, `use`, and `deliver`.
- `GET /scores` — list the top recorded scores (player name and score) from completed sessions.

### Gameplay Notes

- Movement is directional (`north`, `south`, `east`, `west`); use the `go` command to travel (e.g., `go east`).
- Use `pick up` to collect items, `use` to interact (e.g., unlock the study with the brass key), and `deliver` to finish the game once you're in the foyer with the family ledger.
- A score is calculated only when you complete all tasks and deliver the ledger. Fewer turns lead to better scores.
- Every game state payload includes an `available_actions` list, and you can call `GET /sessions/{session_id}/actions` at any time to fetch the current options without advancing the turn.
- The OpenAPI schema advertises `http://127.0.0.1:8005` as the default server, so generated clients point to the local dev instance by default.

### Performing Actions via the API

Build the JSON body with an `action` string and, optionally, a `payload`. The engine accepts classic adventure phrasing, so you can either split the command and target or put everything in the `action` field:

```json
{
  "action": "go",
  "payload": "north"
}
```

```json
{
  "action": "pick up brass key"
}
```

If the engine does not recognise the command it returns a `400` response with a short explanation of what to fix.

### Scoreboard

Calling `GET /scores` returns only finished investigators. Each entry contains the player's name and their final score, ordered from highest to lowest.

Enjoy the investigation!
