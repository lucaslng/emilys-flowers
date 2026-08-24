# Multi-lane agent execution

How parallel specialist lanes are run in this repository — distilled from the
two quality-hardening rounds (PRs #241 and #242), which shipped ~15 lanes
across four waves with zero cross-lane conflicts. Read this before orchestrating
multi-file work with parallel agents.

Lane lifecycle (worktree creation, setup, merge-back, cleanup) is covered by
[`.agents/skills/worktrees/SKILL.md`](../.agents/skills/worktrees/SKILL.md) —
this doc covers what happens *inside* a lane.

## Wave planning

- **One owner per file.** Before dispatching parallel lanes, partition the work
  so no two lanes write the same file. When two concerns both need a file
  (e.g., a route handler wanted by a Stripe-consolidation lane *and* an
  address-pipeline lane), sequence them into separate waves instead of sharing.
- **Scope briefs by pattern, not line numbers.** Line refs go stale as soon as
  any lane lands; give each lane `file + symbol/pattern` anchors and tell it
  line numbers may have shifted.
- **Reuse specialist sessions within a round.** A fixer that already read a
  600-line client file extracts the next component from it far cheaper than a
  fresh session re-reading everything.

## The lane contract

Every implementation lane gets the same rules:

1. Work only inside the lane's worktree; touch **only** the files in its scope.
   Desired out-of-scope changes get reported, not made.
2. The orchestrator owns the gates: lanes must **not** run `typecheck`, `build`,
   `test:e2e`, or any git command. Concurrent typechecks race on `.tsbuildinfo`,
   and concurrent builds collide on `.next/`.
3. Targeted `bun test <file>` runs are allowed and expected for touched logic.
4. Strict TypeScript; comments only for non-obvious *why*; report deviations
   from the brief explicitly (deviations are accepted or bounced on reconcile).
5. Markup/a11y parity is mandatory for refactors of user-visible components —
   same DOM structure, class strings, labels, aria attributes after extraction,
   verified side-by-side against the original.

## Gates and commits

- After all lanes in a wave land: `bun run typecheck`, then `bun test`, then
  `bun run test:e2e` (builds + serves on :3000). Run them once per wave, not
  per lane.
- One commit per lane, scoped like `fix(admin): …`, `refactor(checkout): …`,
  `test(e2e): …`. Never reference other repositories' issues/PRs in messages.
- Independent review of the full branch diff (`git diff <base>..HEAD`) before
  opening a PR. Review nits become small follow-up commits, not amends.

## PR mechanics

- Write the PR body to a temp file and pass `--body-file` to `gh pr create`.
  Inline heredocs break on zsh quoting (markdown paths like `/flowers` in
  tables are the usual trigger).
- Ask before pushing or integrating — the worktree skill's confirmation rules
  apply to merges and pushes too.

## Post-merge cleanup

Follow the worktree skill: verify the lane is clean → `git fetch origin main`
→ ff-only merge in `main/` → remove the worktree → `git branch -d` →
`git remote prune origin`. A `-d` that succeeds confirms the squash/merge
actually landed.
