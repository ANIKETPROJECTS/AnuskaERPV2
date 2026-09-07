---
name: Inventory read performance
description: Performance rule for SubHub inventory pages and workspace reconciliation.
---

Inventory pages should request only the collections needed by the active view, and workspace reconciliation should be deduplicated or cached for short navigation bursts instead of being repeated for every paginated screen.

**Why:** Pagination applied only in the browser does not reduce MongoDB reads or the cost of synchronization, so raw and final inventory pages can appear stuck even when they render only a small page.

**How to apply:** When adding an inventory view, add a narrow server-side data shape and keep migrations/maintenance one-time or guarded; force a fresh reconciliation for writes that depend on current source state.