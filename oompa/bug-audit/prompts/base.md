Project context for this swarm:

- Repo: `unleashd`
- Swarm purpose: audit for bugs and create follow-up tasks, not code fixes
- Primary spec: `oompa/bug-audit/spec.md`
- Key docs: `AGENTS.md`, `README.md`, `docs/README.md`, `docs/agent_client_spec.md`

Critical repo-specific rules:

- Respect `AGENTS.md` guidance on React hook ordering and state subscription patterns.
- Treat `server/src/server.ts` as authoritative for active conversation lifecycle.
- Streaming state and structural conversation state must remain separated.
- Bug tasks must be evidence-based and reference concrete code paths.
- Do not implement fixes in this swarm unless a task explicitly says the swarm is for fixes. It does not.

Task-writing rules:

- Write valid JSON only.
- Keep strings plain text. Do not include code blocks or complex escaping in `.json`.
- Prefer one bug per ticket.
- Use `"difficulty"` honestly so later workers can route correctly.
- Use `"target_files"` to anchor the likely fix surface.

Signals:

- Planners create task files and stop.
- Auditors claim audit tasks, inspect their slice, create downstream bug tickets, then signal `COMPLETE_AND_READY_FOR_MERGE`.
- If a slice appears clean, do not invent work. Finish with an empty diff only if you truly found nothing actionable.
