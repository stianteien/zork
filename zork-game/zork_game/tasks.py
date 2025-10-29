from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class Task:
    key: str
    description: str


TASKS: List[Task] = [
    Task("find_key", "Pick up the brass key hidden somewhere in the kitchen."),
    Task("unlock_study", "Go from the library into the study by unlocking the door with the brass key."),
    Task("retrieve_ledger", "Pick up the family ledger resting on the desk in the study."),
    Task("deliver_ledger", "Deliver the ledger to the foyer table to conclude the investigation."),
]


TASK_LOOKUP: Dict[str, Task] = {task.key: task for task in TASKS}
