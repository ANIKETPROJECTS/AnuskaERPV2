---
name: Hub capacity model
description: The planning rule used for hub capacity, automatic reassignment, and production analysis.
---

Hub capacity is declared by the Hub Manager for their own hub and shown read-only to Admin. It is measured against a hub’s active open target units. Open units are the assigned target minus production already reported for that order. A blank capacity means the hub is unrestricted. Admin-selected assignments and manual moves stay at the chosen hub; excess load is shown as an overload warning rather than silently rerouted. Only orders explicitly designated for automatic routing may be moved by the capacity rebalance.

**Why:** Hub Managers know current staffing and operating constraints, while Admin needs that live declaration for planning. The existing order model stores total order targets and due dates, but not a daily scheduling allocation, so open target units give Admin a deterministic overload rule without inventing a new scheduling calendar. Silently overriding an explicit destination made orders appear under a different SubHub than Admin selected.

**How to apply:** Hub Managers update capacity in their Hub Manager production workspace. Admin sees the declared value, can assign or manually reassign orders, and receives an overload warning when a chosen hub exceeds its limit. Treat legacy assignments as manual. Only opt an order into automatic routing when that behavior is explicitly intended; move production reports with any such order so SubHub history remains continuous.