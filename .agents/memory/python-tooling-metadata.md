---
name: Python tooling metadata
description: Protect existing Python project manifests when temporarily installing analysis tools in this JavaScript workspace.
---

Before adding or removing Python packages for one-off analysis, inspect the tracked `pyproject.toml` and `uv.lock`. Package installation and uninstall commands can rewrite those project files; restore the original dependency set when the analysis is finished.

**Why:** A temporary tool install altered tracked Python dependencies in a TypeScript app, even though no Python feature was part of the requested change.

**How to apply:** Treat Python packages as project dependencies unless the workspace already has an isolated temporary environment; verify manifests after cleanup.
