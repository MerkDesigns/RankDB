# RankDB: shared assistant workflow

Read `CLAUDE.md` before working in this repository. It is the shared source of project rules,
architecture, UI decisions, launch commands and performance constraints for both Codex and Claude.
Read `docs/HANDOFF.md` for the latest verified state, checks and open findings, then
`docs/PLAN.md` and `docs/NOT-CARRIED-OVER.md` for feature scope, and the relevant section of
`docs/ARCHITECTURE.md` before changing an area.

Keep the workflow portable between assistants:
- Keep project decisions in the repository, not only in chat or assistant-specific memory.
- Update `docs/HANDOFF.md` after meaningful work with the changes, validation and remaining work.
- Update `CLAUDE.md` when project rules or architecture change; avoid a second conflicting rulebook.
- Distinguish implemented behavior, verified behavior and proposed work. Do not mark findings fixed
  until the implementation and appropriate checks are complete.
- Preserve the user's saved accounts, credentials, app settings and lab tuning. Follow `CLAUDE.md`'s
  snapshot/restore rules for automation, and prefer attaching to the existing app before launching it.
