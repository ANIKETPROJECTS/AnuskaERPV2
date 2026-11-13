---
name: Bulk procurement groups
description: Preserve factory-level purchase-order assignment while providing a consolidated supplier view for multi-factory runs.
---

A bulk submission is one master procurement order record with a single order number and nested factory/vendor/material allocations. Its status is shared across every allocation, while inventory receipts still fan out to each destination factory.

**Why:** Users need one order ID for one bulk submission, but stock, shortage, and receipt calculations still need the exact vendor, material, and factory allocation.

**How to apply:** Keep one database order record and one shared status; use nested allocations for vendor/factory-level calculations and receipt source identities. Remove legacy procurement order records only in the explicitly authorized one-time cutover, leaving vendors and inventory ledgers intact.
