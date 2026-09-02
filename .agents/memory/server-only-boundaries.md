---
name: Server-only module boundaries
description: Keep browser-shared constants and types separate from modules that import server-only auth, database, or request APIs.
---

Server-only modules must not be imported for runtime values by route components; put shared constants and types in a neutral module and keep database/auth imports behind server functions.

**Why:** TanStack Start's client import protection rejects a route bundle when a runtime import reaches server-only request APIs, even if the route itself only needs a shared status list.

**How to apply:** When a route needs a constant from a server module, move that constant to a shared lib module and import server types with `import type`.