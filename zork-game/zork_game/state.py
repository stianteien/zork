from __future__ import annotations

import datetime as dt
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

from .map import DoorLock, RoomState, build_locks, build_rooms
from .tasks import TASK_LOOKUP, TASKS


class GameRuleError(RuntimeError):
    """Raised when a player attempts an invalid action."""


_CANONICAL_HANDLERS = {
    "look": "look",
    "go": "go",
    "move": "go",
    "walk": "go",
    "take": "pick up",
    "pick": "pick up",
    "pick up": "pick up",
    "grab": "pick up",
    "use": "use",
    "deliver": "deliver",
}

_MULTIWORD_VERBS = ["pick up"]

_TASK_SCORE_VALUES: Dict[str, int] = {
    "find_key": 80,
    "unlock_study": 90,
    "retrieve_ledger": 120,
    "deliver_ledger": 150,
}
_BASE_COMPLETION_SCORE = 150
_MIN_COMPLETION_SCORE = 200
_FAST_TURN_LIMIT = 8
_PAR_TURN_LIMIT = 12
_SLOW_TURN_LIMIT = 35
_OPTIONAL_ROOMS: Set[str] = {"Pantry"}
_OPTIONAL_ITEMS: Set[str] = {"oil lamp"}
_OPTIONAL_ROOM_BONUS = 30
_OPTIONAL_ITEM_BONUS = 20
_OPTIONAL_ITEM_USE_BONUS = 15
_OVERRUN_PENALTY_PER_TURN = 5


@dataclass
class GameState:
    player_name: str
    rooms: Dict[str, RoomState] = field(default_factory=build_rooms)
    locks: Dict[Tuple[str, str], DoorLock] = field(default_factory=build_locks)
    current_room: str = "Foyer"
    inventory: List[str] = field(default_factory=list)
    turn_count: int = 0
    task_status: "OrderedDict[str, bool]" = field(
        default_factory=lambda: OrderedDict((task.key, False) for task in TASKS)
    )
    finished: bool = False
    score: Optional[int] = None
    visited_rooms: Dict[str, int] = field(default_factory=dict)
    item_pickups: Dict[str, int] = field(default_factory=dict)
    item_uses: Dict[str, int] = field(default_factory=dict)
    score_breakdown: Optional[Dict[str, int]] = None

    def __post_init__(self) -> None:
        if self.current_room not in self.visited_rooms:
            self.visited_rooms[self.current_room] = self.turn_count

    def process(self, action: str, payload: Optional[str] = None) -> Dict[str, object]:
        canonical_action, effective_payload = self._normalize_command(action, payload)

        if self.finished and canonical_action != "look":
            return self._make_snapshot(
                "The investigation is complete. Start a new session if you want to play again."
            )

        handler_map = {
            "look": self._handle_look,
            "go": self._handle_move,
            "pick up": self._handle_take,
            "use": self._handle_use,
            "deliver": self._handle_deliver,
        }
        handler = handler_map.get(canonical_action)
        if handler is None:
            raise GameRuleError(f"I don't understand the command '{action.strip()}'.")

        message = handler(effective_payload)
        return self._make_snapshot(message)

    def _handle_look(self, _: Optional[str] = None) -> str:
        room = self.rooms[self.current_room]
        return room.description

    def _handle_move(self, payload: Optional[str]) -> str:
        direction = (payload or "").strip().lower()
        if not direction:
            raise GameRuleError("You need to choose a direction to go (north, south, east, west).")

        room = self.rooms[self.current_room]
        if direction not in room.exits:
            raise GameRuleError("You bump into a wall—there is no path in that direction.")

        lock = self.locks.get((self.current_room, direction))
        if lock and not lock.unlocked:
            raise GameRuleError(f"The {lock.description} is locked tight.")

        destination = room.exits[direction]
        self.current_room = destination
        self._advance_turn()
        self._record_room_visit(destination)

        next_room = self.rooms[destination]
        return f"You go {direction} into the {next_room.name.lower()}."

    def _handle_take(self, payload: Optional[str]) -> str:
        if not payload:
            raise GameRuleError("Name the item you want to pick up.")

        item = payload.strip().lower()
        room = self.rooms[self.current_room]

        normalized_items = {i.lower(): i for i in room.items}
        if item not in normalized_items:
            raise GameRuleError("That item is not here.")

        canonical_item = normalized_items[item]
        room.items.remove(canonical_item)
        self.inventory.append(canonical_item)
        self._advance_turn()
        self._record_item_pickup(canonical_item)

        self._complete_task("find_key", canonical_item == "brass key")
        self._complete_task("retrieve_ledger", canonical_item == "family ledger")

        return f"You pick up the {canonical_item}."

    def _handle_use(self, payload: Optional[str]) -> str:
        if not payload:
            raise GameRuleError("Specify the item you want to use.")

        item = payload.strip().lower()
        normalized_inventory = {i.lower(): i for i in self.inventory}
        if item not in normalized_inventory:
            raise GameRuleError("You are not carrying that.")

        canonical_item = normalized_inventory[item]
        self._advance_turn()
        self._record_item_use(canonical_item)

        if canonical_item == "brass key":
            lock = self.locks.get((self.current_room, "east"))
            if lock and not lock.unlocked and lock.requires == canonical_item:
                lock.unlocked = True
                self._complete_task("unlock_study", True)
                return "You turn the brass key and hear the study door unlock with a soft click."
            if lock and lock.unlocked:
                return "The study door is already open."
            return "There is nothing here that the key will unlock."

        if canonical_item == "oil lamp":
            return "The lamp flickers warmly, but it does not reveal anything new."

        return "You cannot find a useful way to use that."

    def _normalize_command(self, action: str, payload: Optional[str]) -> Tuple[str, Optional[str]]:
        raw_action = (action or "").strip()
        if not raw_action:
            raise GameRuleError("Choose an action to continue.")

        original_tokens = raw_action.split()
        lower_tokens = [token.lower() for token in original_tokens]

        verb_length = 1
        verb_candidate = lower_tokens[0]
        for candidate in _MULTIWORD_VERBS:
            parts = candidate.split()
            if lower_tokens[: len(parts)] == parts:
                verb_candidate = candidate
                verb_length = len(parts)
                break

        canonical_action = _CANONICAL_HANDLERS.get(verb_candidate)
        if not canonical_action:
            raise GameRuleError(f"I don't understand the command '{raw_action}'.")

        payload_from_action_tokens = original_tokens[verb_length:]
        payload_from_action = " ".join(payload_from_action_tokens).strip() or None

        provided_payload = (payload or "").strip() or None
        effective_payload = provided_payload or payload_from_action

        return canonical_action, effective_payload

    def _handle_deliver(self, payload: Optional[str]) -> str:
        if self.current_room != "Foyer":
            raise GameRuleError("You need to be in the foyer to deliver the ledger.")
        if "family ledger" not in self.inventory:
            raise GameRuleError("You cannot deliver what you do not have.")

        self._advance_turn()
        self._complete_task("deliver_ledger", True)
        self._finalize_score()
        return (
            "You place the ledger on the foyer table. The family mystery is solved and your investigation complete!"
        )

    def _advance_turn(self) -> None:
        self.turn_count += 1

    def _complete_task(self, key: str, condition: bool) -> None:
        if condition and not self.task_status[key]:
            self.task_status[key] = True

    def _record_room_visit(self, room_name: str) -> None:
        if room_name not in self.visited_rooms:
            self.visited_rooms[room_name] = self.turn_count

    def _record_item_pickup(self, item_name: str) -> None:
        if item_name not in self.item_pickups:
            self.item_pickups[item_name] = self.turn_count

    def _record_item_use(self, item_name: str) -> None:
        if item_name not in self.item_uses:
            self.item_uses[item_name] = self.turn_count

    def _finalize_score(self) -> None:
        if self.finished:
            return
        breakdown = self._compute_score_breakdown()
        all_completed = all(self.task_status.values())
        total = sum(breakdown.values())
        minimum = _MIN_COMPLETION_SCORE if all_completed else 75
        self.score_breakdown = breakdown
        self.score = max(minimum, total)
        self.finished = True

    def available_actions(self) -> List[str]:
        """Return the set of currently valid command phrases."""
        room = self.rooms[self.current_room]

        actions: List[str] = ["look"]
        for direction in room.exits:
            lock = self.locks.get((self.current_room, direction))
            if lock and not lock.unlocked:
                continue
            actions.append(f"go {direction}")

        for item in room.items:
            actions.append(f"pick up {item}")

        for item in self.inventory:
            actions.append(f"use {item}")

        if self.current_room == "Foyer" and "family ledger" in self.inventory and not self.finished:
            actions.append("deliver ledger")

        return actions

    def _make_snapshot(self, message: str) -> Dict[str, object]:
        room = self.rooms[self.current_room]
        locked_exits = [
            {
                "direction": direction,
                "description": lock.description,
            }
            for (room_name, direction), lock in self.locks.items()
            if room_name == self.current_room and not lock.unlocked
        ]

        tasks = [
            {
                "key": key,
                "description": TASK_LOOKUP[key].description,
                "completed": completed,
            }
            for key, completed in self.task_status.items()
        ]

        return {
            "player_name": self.player_name,
            "current_room": room.name,
            "room_description": room.description,
            "exits": dict(room.exits),
            "locked_exits": locked_exits,
            "items_in_room": list(room.items),
            "inventory": list(self.inventory),
            "turn_count": self.turn_count,
            "tasks": tasks,
            "finished": self.finished,
            "score": self.score,
            "score_breakdown": dict(self.score_breakdown) if self.score_breakdown else None,
            "message": message,
            "available_actions": self.available_actions(),
        }

    def snapshot(self, message: str) -> Dict[str, object]:
        return self._make_snapshot(message)

    def _compute_score_breakdown(self) -> "OrderedDict[str, int]":
        breakdown: "OrderedDict[str, int]" = OrderedDict()
        breakdown["completion"] = _BASE_COMPLETION_SCORE

        task_total = sum(
            points for key, points in _TASK_SCORE_VALUES.items() if self.task_status.get(key)
        )
        if task_total:
            breakdown["tasks"] = task_total

        efficiency_bonus = self._compute_efficiency_bonus()
        if efficiency_bonus:
            breakdown["efficiency_bonus"] = efficiency_bonus

        if self.turn_count > _SLOW_TURN_LIMIT:
            overrun_penalty = -_OVERRUN_PENALTY_PER_TURN * (self.turn_count - _SLOW_TURN_LIMIT)
            breakdown["overrun_penalty"] = overrun_penalty

        visited_optional = _OPTIONAL_ROOMS.intersection(self.visited_rooms)
        if visited_optional:
            breakdown["exploration_bonus"] = _OPTIONAL_ROOM_BONUS * len(visited_optional)

        collected_optional = _OPTIONAL_ITEMS.intersection(self.item_pickups)
        if collected_optional:
            breakdown["curiosity_bonus"] = _OPTIONAL_ITEM_BONUS * len(collected_optional)

        used_optional = _OPTIONAL_ITEMS.intersection(self.item_uses)
        if used_optional:
            breakdown["experimentation_bonus"] = _OPTIONAL_ITEM_USE_BONUS * len(used_optional)

        return breakdown

    def _compute_efficiency_bonus(self) -> int:
        if self.turn_count <= _FAST_TURN_LIMIT:
            return 120
        if self.turn_count <= _PAR_TURN_LIMIT:
            span = max(1, _PAR_TURN_LIMIT - _FAST_TURN_LIMIT)
            ratio = (self.turn_count - _FAST_TURN_LIMIT) / span
            value = 120 - 60 * ratio
            return int(round(max(0.0, value)))
        if self.turn_count < _SLOW_TURN_LIMIT:
            span = max(1, _SLOW_TURN_LIMIT - _PAR_TURN_LIMIT)
            ratio = (self.turn_count - _PAR_TURN_LIMIT) / span
            ratio = max(0.0, min(1.0, ratio))
            value = 60 * (1 - ratio) ** 1.3
            return int(round(max(0.0, value)))
        return 0


@dataclass
class ScoreEntry:
    session_id: str
    player_name: str
    score: int
    turns: int
    finished_at: dt.datetime

    def to_dict(self) -> Dict[str, object]:
        return {
            "session_id": self.session_id,
            "player_name": self.player_name,
            "score": self.score,
            "turns": self.turns,
            "finished_at": self.finished_at.isoformat(),
        }


def create_game(player_name: str) -> GameState:
    return GameState(player_name=player_name)
