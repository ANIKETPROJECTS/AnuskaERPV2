---
name: Quality adjustment grid
description: The SubHub quality screen uses a unified signed stock-change grid for all inventory categories.
---

The SubHub quality screen presents all current raw materials and final products as one compact list. Operators enter the desired nonnegative whole-number stock count, not a signed delta. The server computes the difference against the latest quantity inside the adjustment transaction. Quantity increases and decreases select matching reasons automatically; explicit alternative reasons remain available.

**Why:** Physical stock counts are absolute values. Treating an entered count as a delta can accidentally double the balance; calculating the delta from current transactional stock also keeps FIFO batch reductions aligned.

**How to apply:** Keep additions and FIFO-safe removals on the existing inventory transaction path, derive changes as target count minus latest stock, require a reason for every non-zero change, and submit multiple changed rows in one transaction.