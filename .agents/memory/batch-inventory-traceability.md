---
name: Batch inventory traceability
description: Durable rules for batch allocation, stock movements, and production lineage.
---

Batch inventory and aggregate item balances must be updated together inside MongoDB transactions. Production consumes source batches by FIFO unless the operator records exact split overrides, and final-product lineage exposes only the active allocation revision.

**Why:** Independent writes or replayed reconciliation can leave aggregate stock, batch balances, movements, and product lineage inconsistent after failures or concurrent saves.

**How to apply:** Any new receipt, adjustment, defect, production, report edit, deletion, or source reconciliation must use deterministic event identities and one transaction. Do not allow material-affecting report changes after any derived batch has been consumed or rejected.