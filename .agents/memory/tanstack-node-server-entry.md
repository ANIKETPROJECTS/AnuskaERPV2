---
name: TanStack Node server output
description: A Nitro node-server build constraint for TanStack Start and server-only dependencies.
---

For TanStack Start projects built with Nitro's `node-server` preset, keep the framework's default server entry instead of overriding it with a custom `src/server.ts` wrapper. Put server-only startup work in a `.server.ts` module and reach it through an isomorphic server/client boundary so Node-only dependencies never enter the browser bundle.

**Why:** A custom server entry named `server` can collide with TanStack's generated SSR server module in the Nitro Node output. Directly importing a MongoDB helper from a shared Start module also causes the MongoDB driver to be bundled for the browser.

**How to apply:** Use the default TanStack server entry, `createIsomorphicFn().client(...).server(...)` for startup checks, and a cached MongoDB client in a `.server.ts` module.