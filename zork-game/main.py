import datetime as dt
import threading
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, validator

from zork_game import GameRuleError, GameState, ScoreEntry, create_game


class LockedExitModel(BaseModel):
    direction: str
    description: str


class TaskStatusModel(BaseModel):
    key: str
    description: str
    completed: bool


class GameStateModel(BaseModel):
    message: str
    player_name: str
    current_room: str
    room_description: str
    exits: Dict[str, str]
    locked_exits: List[LockedExitModel]
    items_in_room: List[str]
    inventory: List[str]
    turn_count: int
    tasks: List[TaskStatusModel]
    finished: bool
    score: Optional[int]
    score_breakdown: Optional[Dict[str, int]]
    available_actions: List[str]

    @classmethod
    def from_snapshot(cls, snapshot: Dict[str, object]) -> "GameStateModel":
        return cls(**snapshot)


class SessionCreateRequest(BaseModel):
    player_name: str = Field(..., min_length=1, max_length=40, description="Displayed name for the session.")

    @validator("player_name")
    def strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Player name cannot be empty.")
        return stripped


class SessionCreateResponse(BaseModel):
    session_id: str
    state: GameStateModel


class ActionRequest(BaseModel):
    action: str = Field(
        ...,
        description=(
            "Command to perform, e.g. 'go', 'go north', 'pick up', 'use lamp', 'look', or 'deliver'."
            " You may either include the target in the action string or provide it via the payload field."
        ),
    )
    payload: Optional[str] = Field(None, description="Optional data for the action, such as a direction or item.")


class ScoreModel(BaseModel):
    player_name: str
    score: int


class ScoreboardResponse(BaseModel):
    scores: List[ScoreModel]


class AvailableActionsResponse(BaseModel):
    session_id: str
    available_actions: List[str]


app = FastAPI(
    title="Zork-Like House Mystery",
    version="0.1.0",
    description=(
        "A turn-based, session-oriented text adventure API inspired by classic Zork gameplay. "
        "Start a session, explore the old house, and return the family ledger to win."
    ),
    servers=[
        {
            "url": "http://127.0.0.1:8005",
            "description": "Local development server",
        }
    ],
)

_sessions: Dict[str, GameState] = {}
_scoreboard: List[ScoreEntry] = []
_lock = threading.Lock()


def _ensure_session(session_id: str) -> GameState:
    state = _sessions.get(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return state


@app.post("/sessions", response_model=SessionCreateResponse)
def start_session(request: SessionCreateRequest) -> SessionCreateResponse:
    player_name = request.player_name
    session_id = uuid4().hex
    state = create_game(player_name=player_name)
    welcome_message = (
        f"Welcome, {player_name}! You stand in the foyer of the old house. "
        "Explore the rooms, recover the family ledger, and return it to the foyer table."
    )

    snapshot = state.snapshot(welcome_message)
    with _lock:
        _sessions[session_id] = state

    return SessionCreateResponse(session_id=session_id, state=GameStateModel.from_snapshot(snapshot))


@app.get("/sessions/{session_id}", response_model=GameStateModel)
def get_session_state(session_id: str) -> GameStateModel:
    with _lock:
        state = _ensure_session(session_id)
        snapshot = state.snapshot("Here is your current status.")
    return GameStateModel.from_snapshot(snapshot)


@app.get("/sessions/{session_id}/actions", response_model=AvailableActionsResponse)
def list_available_actions(session_id: str) -> AvailableActionsResponse:
    with _lock:
        state = _ensure_session(session_id)
        actions = state.available_actions()
    return AvailableActionsResponse(session_id=session_id, available_actions=actions)


@app.post("/sessions/{session_id}/actions", response_model=GameStateModel)
def perform_action(session_id: str, request: ActionRequest) -> GameStateModel:
    with _lock:
        state = _ensure_session(session_id)
        try:
            snapshot = state.process(request.action, request.payload)
        except GameRuleError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if state.finished and state.score is not None:
            already_recorded = any(entry.session_id == session_id for entry in _scoreboard)
            if not already_recorded:
                entry = ScoreEntry(
                    session_id=session_id,
                    player_name=state.player_name,
                    score=state.score,
                    turns=state.turn_count,
                    finished_at=dt.datetime.utcnow(),
                )
                _scoreboard.append(entry)
                _scoreboard.sort(key=lambda record: (-record.score, record.turns))

    return GameStateModel.from_snapshot(snapshot)


@app.get("/scores", response_model=ScoreboardResponse)
def get_scores(limit: int = 10) -> ScoreboardResponse:
    with _lock:
        top_scores = [_scoreboard[i] for i in range(min(limit, len(_scoreboard)))]
        models = [
            ScoreModel(
                player_name=entry.player_name,
                score=entry.score,
            )
            for entry in top_scores
        ]
    return ScoreboardResponse(scores=models)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
