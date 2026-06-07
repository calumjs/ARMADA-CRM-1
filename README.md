# ARMADA-CRM-1

A CRM project, commissioned to run on the [ARMADA](https://github.com/calumjs/ARMADA) fleet — a set of Claude Code skills that watch GitHub issues and drive them to merge-ready PRs.

## ARMADA

This repo is commissioned for ARMADA. Config lives in [`.armada/config.json`](.armada/config.json).

- **Trigger label:** `armada` — label an issue with it to hand it to the fleet.
- **Base branch:** `main`
- **Auto-merge:** off — the ready-PR pipeline stops at "awaiting human merge".

### Working an issue

```bash
# 1. File an issue (or use /charter to draft + arm one)
# 2. Arm it for the fleet
gh issue edit <number> --add-label armada
# 3. Man the lookout (run the crows-nest skill, or say "watch for issues")
```

## Status

Greenfield — no application code yet. Build/test/lint/run commands in
`.armada/config.json` are empty and will be filled in as the project's stack is chosen.
