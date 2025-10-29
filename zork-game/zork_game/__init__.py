"""Core package exports for the Zork-like adventure game."""

from .map import DoorLock, HOUSE_TEMPLATE, LOCK_TEMPLATES, RoomState, build_locks, build_rooms
from .state import GameRuleError, GameState, ScoreEntry, create_game
from .tasks import TASKS, TASK_LOOKUP, Task

__all__ = [
    "GameRuleError",
    "GameState",
    "ScoreEntry",
    "create_game",
    "RoomState",
    "DoorLock",
    "HOUSE_TEMPLATE",
    "LOCK_TEMPLATES",
    "build_rooms",
    "build_locks",
    "Task",
    "TASKS",
    "TASK_LOOKUP",
]
