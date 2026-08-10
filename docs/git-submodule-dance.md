# Submodule commit dance (vendor/agent-cli-tool)

(Moved out of AGENTS.md to keep startup context small.)

## Submodule commit dance (vendor/agent-cli-tool)

`vendor/agent-cli-tool` is a **git submodule** with its own history. Commits
inside it are separate from the outer repo. The outer repo stores a **pointer
SHA** — bumping that pointer is how you pull in submodule changes.

### The order that actually works

1. **Inside the submodule**: `git add`, `git commit`, `git push origin main`.
2. **Outer repo**: `git add vendor/agent-cli-tool` (stages the pointer bump).
3. **Verify**: `git diff --cached vendor/agent-cli-tool` — should show
   `-Subproject commit <old-sha>` / `+Subproject commit <new-sha>`.
4. **Outer**: `git commit` + `git push origin main`.

Pushing the outer pointer before pushing the submodule leaves anyone else
cloning on a broken ref. Always submodule-first.

### `git status` cheatsheet for submodules

| Symbol | Meaning |
|---|---|
| `M vendor/agent-cli-tool` | Pointer staged to move (capital M) |
| ` M vendor/agent-cli-tool` | Pointer moved but not staged |
| ` m vendor/agent-cli-tool` | **Content inside the submodule is dirty** (lowercase m) |
| `Mm vendor/agent-cli-tool` | Pointer bumped AND inside is dirty. Only the pointer is part of the outer commit; the `m` is separate work. |

### Don't push main unless asked

Pushing to main is a write to shared state. The assistant never pushes unless
the user explicitly authorizes it.

---
