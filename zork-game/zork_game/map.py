from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Dict, List, Tuple


@dataclass
class RoomState:
    name: str
    description: str
    exits: Dict[str, str]
    items: List[str] = field(default_factory=list)

    def clone(self) -> "RoomState":
        return RoomState(
            name=self.name,
            description=self.description,
            exits=deepcopy(self.exits),
            items=list(self.items),
        )


@dataclass
class DoorLock:
    room: str
    direction: str
    requires: str
    description: str
    unlocked: bool = False

    @property
    def key(self) -> Tuple[str, str]:
        return self.room, self.direction


HOUSE_TEMPLATE: Dict[str, RoomState] = {
    "Foyer": RoomState(
        name="Foyer",
        description=(
            "The foyer is tidy, save for a dust-covered table awaiting the missing family ledger. "
            "Stairs lead upward, but tonight your focus is on the ground floor mysteries."
        ),
        exits={"north": "Kitchen", "east": "Library"},
        items=[],
    ),
    "Kitchen": RoomState(
        name="Kitchen",
        description=(
            "Warm light spills across the kitchen counter. A recipe card hints that something "
            "important was tucked away for safe keeping."
        ),
        exits={"south": "Foyer", "east": "Pantry"},
        items=["brass key"],
    ),
    "Pantry": RoomState(
        name="Pantry",
        description=(
            "The pantry smells of herbs and old wood. Shelves are neatly arranged, but nothing "
            "here seems tied to the family's secrets."
        ),
        exits={"west": "Kitchen"},
        items=[],
    ),
    "Library": RoomState(
        name="Library",
        description=(
            "Tall shelves loom overhead. Candlelight flickers across a locked door leading into "
            "the private study."
        ),
        exits={"west": "Foyer", "east": "Study"},
        items=["oil lamp"],
    ),
    "Study": RoomState(
        name="Study",
        description=(
            "The study is serene, papers untouched for years. The ledger you seek sits squarely "
            "on the desk, begging to be returned to the foyer."
        ),
        exits={"west": "Library"},
        items=["family ledger"],
    ),
}


LOCK_TEMPLATES: List[DoorLock] = [
    DoorLock(
        room="Library",
        direction="east",
        requires="brass key",
        description="study door",
    )
]


def build_rooms() -> Dict[str, RoomState]:
    return {name: room.clone() for name, room in HOUSE_TEMPLATE.items()}


def build_locks() -> Dict[Tuple[str, str], DoorLock]:
    locks: Dict[Tuple[str, str], DoorLock] = {}
    for template in LOCK_TEMPLATES:
        locks[template.key] = DoorLock(
            room=template.room,
            direction=template.direction,
            requires=template.requires,
            description=template.description,
            unlocked=template.unlocked,
        )
    return locks
