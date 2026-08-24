# Skill: worktrees (Emily's Flowers project convention)

This project manages worktree lanes through **OpenChamber**. Lanes are not
created by hand with `git worktree add`; OpenChamber creates, integrates, and
removes them. The repository itself keeps its **bare-repo layout**:

- `.bare/` — shared object store, refs, config
- `.git` — a *file* containing `gitdir: ./.bare`
- `main/` — the primary checkout, registered as the OpenChamber project
- Legacy sibling lanes (`feature/<slug>/`, `bugfix/<slug>/`) may still exist
  until integrated and removed

This replaces both the old sibling-directory protocol and the global
oh-my-opencode-slim `.slim/worktrees/` skill — follow neither of those.

## Layout facts

- New lanes live under OpenChamber's managed data dir:
  `~/.local/share/opencode/worktree/<repo-hash>/<name>/`. This location is not
  configurable.
- Folder names are slugs of the branch name: `feature/foo` → `feature-foo`.
- Register only `main/` as the OpenChamber project. Never register the parent
  dir (`.../emilys-flowers`) — git cannot resolve a toplevel there.
- Existing sibling worktrees are discovered automatically and fully manageable
  (Integrate / remove) from the Worktrees UI.

## Branch prefixes (unchanged)

Every lane branch uses one of:

- `feature/` — new functionality or enhancements
- `bugfix/` — defect fixes
- `docs/` — documentation-only changes

Always name the branch explicitly; never let OpenChamber auto-name it
(unnamed branches default to `openchamber/<folder>`). Base new lanes on `main`.

## Creating a lane

1. Pre-flight: run `git worktree list` to see existing lanes; confirm the
   branch does not already exist locally or remotely
   (`git branch -a | grep <branch>`).
2. Get explicit user confirmation for the branch name and base.
3. Create it through OpenChamber:
   - **UI**: new-worktree dialog → new branch `<prefix>/<slug>` from `main`.
   - **Agent**: an OpenChamber session created with `worktree` + `branch` +
     `startRef` parameters.
4. Bootstrap runs automatically from the per-project `setup-worktree` config
   (`~/.config/openchamber/projects/<projectId>.json`):
   `bun install`, then `cp $ROOT_PROJECT_PATH/.env .env`
   (`$ROOT_PROJECT_PATH` = the `main/` checkout). With
   `"setup-worktree-wait": true`, session start blocks until setup finishes
   (~5 min cap). Without it, builds fail at the Stripe catalog step until
   `.env` exists.

### Uncommitted changes

OpenChamber never carries uncommitted changes into a new worktree. Move WIP by
committing it to a temp branch first and basing the lane on that branch, or by
copying files manually. Stashes still live in the shared `.bare/`, so any
worktree can pop one — but the old stash-push/pop choreography between sibling
lanes is obsolete for new lanes.

## Working in a lane

- All edits, builds, and tests happen inside the lane directory; never modify
  `main/` for lane work.
- Track file/folder ownership per lane when running parallel agents.
- Commit progress within the worktree only when the user asked for commits or
  approved local checkpoint commits.

## Integration & validation

Before integrating:

1. Validate inside the lane: `bun run typecheck`, `bun test`,
   `bun run test:e2e`. There is no `lint` script.
2. Review the diff against base (`git diff main..<branch> --stat` or the
   Changes view).
3. Ask the user for confirmation to integrate.
4. Use **Integrate** in OpenChamber's Git view with target `main`. Semantics:
   - **Cherry-pick**, not merge/rebase: commits are copied onto the target;
     no merge commit; history stays linear.
   - Patch-equivalent commits already on the target are skipped.
   - Conflicts surface in the UI — resolve manually or hand them to the agent.
   - After success, other *clean* worktrees on the target get `reset --hard`
     (so `main/` syncs automatically).
   - The source branch survives untouched — deleting it is a separate step.

When creating a PR with `gh pr create`, use `--body-file <(cat <<'EOF' … )`
instead of `--body` so markdown paths like `/flowers` aren't shell-mangled.

## Cleanup

1. Ensure changes are integrated or archived.
2. Remove the worktree from OpenChamber's Manage-worktrees UI after user
   confirmation. It warns about uncommitted changes (lost) and attached
   sessions (archived).
3. Branch deletion is opt-in via checkboxes ("Also delete local branch" /
   "Also delete remote branch"). Post-cherry-pick, plain `git branch -d`
   refuses because copied commits are not ancestors — the `-D` checkbox is
   the intended path; always confirm with the user first.
4. Session archive/delete ≠ worktree removal — archiving a session leaves the
   worktree and branch in place.

## Mandatory user confirmation

Seek explicit user confirmation before executing:

- creating or removing any worktree (OpenChamber dialog, agent-created
  session with a worktree, or raw git)
- branch creation, deletion, or renaming
- integrating onto another branch; merges, rebases, cherry-picks
- destructive commands (`git reset --hard`, `git clean`, force push, removing
  a dirty worktree)

Never execute destructive operations without explicit confirmation for that
exact operation.
