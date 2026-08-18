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

Run from the repo root — the parent of `main/`, i.e. `/Users/lucas/Documents/emilys-flowers`.
The shell's working directory is usually `main/`, so a relative path like
`bugfix/<slug>` would create the lane *inside* `main/`. Use an absolute path or
`git -C` from the parent:

```bash
git worktree add -b <prefix>/<slug> <prefix>/<slug> <base>
```

`<base>` is usually `main`. For example:

```bash
git worktree add -b docs/worktree-convention docs/worktree-convention main
```

This creates the directory `<prefix>/<slug>/` checked out on the new branch.

## Lane setup (fresh worktree)

A new worktree has no `node_modules` and no env files. Before building or
typechecking inside the lane:

```bash
bun install
cp ../../main/.env .env
```

The lane lives at `<prefix>/<slug>/`, so `main/` is two levels up — `../main/`
would resolve to `<prefix>/main/` and fail. Use `../../main/.env` (or an
absolute path like `/Users/lucas/Documents/emilys-flowers/main/.env`).

`.env` is gitignored. The build-time Stripe catalog fetch needs
`STRIPE_SECRET_KEY` (the test key lives in `main/.env`); without it
`bun run build` fails at the catalog step.

## Moving uncommitted changes into a lane

When work starts in one worktree (e.g., `main/`) but belongs in a new lane,
move the uncommitted changes with a stash. The stash lives in the shared bare
repo (`.bare/`), so any worktree can pop it — no file copying or re-editing.

```bash
# 1. In the source worktree, stash working-tree changes INCLUDING untracked files:
git stash push -u -m "move to <prefix>/<slug>"

# 2. Confirm the source is clean (output should be empty):
git status --short

# 3. Create the lane as usual (from the repo root):
git worktree add -b <prefix>/<slug> <prefix>/<slug> <base>

# 4. In the new worktree, apply the stash:
git -C <prefix>/<slug> stash pop

# 5. Verify the changes landed:
git -C <prefix>/<slug> status --short
```

Gotchas:

- `-u` is required: plain `git stash push` skips untracked files, and new files
  (e.g., a freshly written doc) are untracked until staged.
- Create the lane from the same base the stash was taken against (usually
  `main`). If the base has diverged, `stash pop` may conflict — but the stash is
  only dropped on success, so the changes stay recoverable at `refs/stash`
  (fall back to `git stash show -p | git apply`, or copy the files).
- This moves working-tree changes only. Already-committed changes move via
  cherry-pick, or by creating the lane from the branch that contains them.
- After a successful pop the source worktree is clean and the stash is dropped
  automatically.

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

1. Run build/typecheck inside the worktree directory. This project has
   `bun run typecheck` (tsc --noEmit), `bun test`, and `bun run test:e2e`
   scripts — see `AGENTS.md` Commands. There is no `lint` script.
2. Generate a diff against the base: `git diff main..<branch> --stat`.
3. Ask the user for confirmation to integrate.
4. Perform the approved integration (merge, cherry-pick, or PR) from the
   `main/` worktree or a user-approved checkout.

5. When creating a PR with `gh pr create`, use `--body-file` with a heredoc
   instead of `--body` to avoid shell interpretation of markdown paths like
   `/flowers` in table cells:

   ```bash
   gh pr create \
     --base main \
     --head <prefix>/<slug> \
     --title "..." \
     --body-file <(cat <<'EOF'
   ## Summary

   ...
   Closes #NN
   EOF
   )
   ```

## Cleanup

1. Ensure all changes are safely merged or archived.
2. Confirm the worktree has no uncommitted changes: `git -C <path> status`.
3. Request user approval to remove the worktree.
4. Remove it:

   ```bash
   git worktree remove <prefix>/<slug>
   ```

5. Fast-forward local `main` to `origin/main` so the safe `-d` recognizes the
   merge (when a PR was merged on the remote, local `main` lags behind and `-d`
   would otherwise refuse the branch as "not merged to HEAD"). Fetch first —
   a stale `origin/main` tracking ref makes the merge report "Already up to
   date" even though the remote has moved:

   ```bash
   git fetch origin main
   git -C main merge --ff-only origin/main
   ```

6. Delete the branch if it was not integrated:

   ```bash
   git branch -d <prefix>/<slug>
   ```

   Avoid `git branch -D`: the `cc-safety-net` plugin blocks force-delete, and
   it's unnecessary once `main` is fast-forwarded — `-d` succeeds and confirms
   the branch was actually merged.

7. Prune stale remote-tracking refs. GitHub auto-deletes the branch on merge,
   so `origin/<prefix>/<slug>` lingers locally and `git push origin --delete`
   fails with "remote ref does not exist":

   ```bash
   git remote prune origin
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