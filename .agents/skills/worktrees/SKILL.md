# Skill: worktrees (Emily's Flowers project convention)

This project uses a **bare-repo + sibling-worktree** layout. It does **not**
use the oh-my-opencode-slim `.slim/worktrees/` protocol. Follow this convention
when working in this repository.

## Layout

The repository root is a bare git repository:

- `.bare/` — shared object store, refs, config
- `.git` — a *file* (not a directory) containing `gitdir: ./.bare`, so git
  commands run from the root operate against the bare repo
- Worktrees are sibling directories at the root, each checked out on its own
  branch, organized by branch prefix:

```text
emilys-flowers/
├── .bare/                          # shared bare store
├── .git                           # file → gitdir: ./.bare
├── main/                          # worktree on `main`
├── feature/<slug>/                # worktree on `feature/<slug>`
├── bugfix/<slug>/                 # worktree on `bugfix/<slug>`
└── docs/<slug>/                   # worktree on `docs/<slug>`
```

There is no `.slim/`, no `worktrees.json` manifest, and no managed ignore block
for worktrees. Do not create them.

## Branch prefixes

Per `AGENTS.md`, every new branch must use one of:

- `feature/` — new functionality or enhancements
- `bugfix/` — defect fixes
- `docs/` — documentation-only changes

The worktree path mirrors the branch: `<prefix>/<slug>/`. Older branches that
predate the policy (`coop-header`, `remove-buildcommand-vercel`) are left
unprefixed — do not rename them; apply prefixes to new work only.

## Pre-flight before creating a lane

1. Run `git worktree list` from the repo root to see existing lanes and avoid
   path/branch conflicts.
2. Confirm the target branch name does not already exist locally or on remote:
   `git branch -a | grep <branch>`.
3. Confirm the target path `<prefix>/<slug>/` does not already exist.
4. Get explicit user confirmation before running `git worktree add`.

## Creating a worktree

From the repo root:

```bash
git worktree add -b <prefix>/<slug> <prefix>/<slug> <base>
```

`<base>` is usually `main`. For example:

```bash
git worktree add -b docs/worktree-convention docs/worktree-convention main
```

This creates the directory `<prefix>/<slug>/` checked out on the new branch.

## Working in a lane

- Run all edits, builds, and tests inside the worktree directory
  (`<prefix>/<slug>/`), not the `main/` checkout.
- Do not modify the `main/` worktree for lane work.
- Track file/folder ownership per lane to avoid merge conflicts between
  parallel agents.
- Commit progress within the worktree only when the user asked for commits or
  approved local checkpoint commits.

## Integration & validation

Before merging a lane back:

1. Run build/typecheck inside the worktree directory. This project has no
   `lint`/`typecheck`/`test` script — use `bun run build` and
   `bunx tsc --noEmit`.
2. Generate a diff against the base: `git diff main..<branch> --stat`.
3. Ask the user for confirmation to integrate.
4. Perform the approved integration (merge, cherry-pick, or PR) from the
   `main/` worktree or a user-approved checkout.

## Cleanup

1. Ensure all changes are safely merged or archived.
2. Confirm the worktree has no uncommitted changes: `git -C <path> status`.
3. Request user approval to remove the worktree.
4. Remove it:

   ```bash
   git worktree remove <prefix>/<slug>
   ```

5. Delete the branch if it was not integrated:

   ```bash
   git branch -d <prefix>/<slug>   # or -D if the user approves force-delete
   ```

## Mandatory user confirmation

Seek explicit user confirmation before executing:

- `git worktree add` or `git worktree remove`
- branch creation, deletion, or renaming
- merges, rebases, or cherry-picks
- `git prune` or `git worktree prune`
- destructive commands (`git reset --hard`, `git clean`, `git push --force`,
  removing a dirty worktree)

Never execute destructive commands or remove uncommitted changes without
explicit confirmation for that exact operation.