---
name: Hub capacity model
description: The planning rule used for hub capacity, automatic reassignment, and production analysis.
---

Hub capacity is an Admin-owned limit on a hub’s active open target units. Open units are the assigned target minus production already reported for that order. A blank capacity means the hub is unrestricted.

**Why:** The existing order model stores total order targets and due dates, but not a daily scheduling allocation. Using open target units gives Admin a deterministic overload rule without inventing a new scheduling calendar.

**How to apply:** When capacity changes or a new order is assigned, move the newest open order to an eligible hub with enough remaining capacity. Move its production reports with it so SubHub history remains continuous. If no eligible hub has room, leave the source visibly overloaded rather than silently exceeding another hub’s limit.