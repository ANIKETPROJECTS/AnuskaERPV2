---
name: Bulk procurement groups
description: Preserve factory-level purchase-order assignment while providing a consolidated supplier view for multi-factory runs.
---

A multi-factory bulk run remains a set of hub-scoped purchase orders linked by a shared run ID. Supplier totals are computed across that group, while each factory's allocation stays attached to its own order.

**Why:** Hub material-need calculations, permissions, and delivery tracking assume each order has one destination. Combining records into a single hub-scoped order would misattribute stock and disrupt those flows.

**How to apply:** When adding bulk-order features, aggregate by shared run ID for supplier-facing summaries, but keep per-factory quantities and status records intact unless all hub-scoped queries and access rules are redesigned together.
