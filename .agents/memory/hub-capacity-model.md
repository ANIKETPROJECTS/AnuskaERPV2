---
name: Hub capacity model
description: The planning rule used for hub capacity, automatic reassignment, and production analysis.
---

Hub capacity is declared by the Hub Manager for their own hub and shown read-only to Admin. It is measured against a hub’s active open target units. Open units are the assigned target minus production already reported for that order. A blank capacity means the hub is unrestricted.

**Why:** Hub Managers know current staffing and operating constraints, while Admin needs that live declaration for planning. The existing order model stores total order targets and due dates, but not a daily scheduling allocation, so open target units give Admin a deterministic overload rule without inventing a new scheduling calendar.

**How to apply:** Hub Managers update capacity in their Hub Manager production workspace. Admin sees the declared value, can assign or manually reassign orders, and the system may automatically move the newest open order to an eligible hub with enough remaining capacity. Move production reports with the order so SubHub history remains continuous. If no eligible hub has room, leave the source visibly overloaded rather than silently exceeding another hub’s limit.