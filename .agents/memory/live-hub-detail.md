---
name: Live hub detail
description: Admin hub details must resolve the real SubHub workspace by user ID rather than the legacy seeded hub code.
---

The Hubs & Stock cards link to a live detail route keyed by the SubHub manager user ID. The detail view reads control-plane orders and capacity plus the manager's workspace inventory snapshot, reports, batches, movements, quality logs, and order activity.

**Why:** The older hub-code route is seeded/static data and cannot represent the current MongoDB-backed SubHub workspace.

**How to apply:** Keep Admin authorization and user-ID scoping on detail reads; do not substitute seeded hub records when adding live hub-level views.