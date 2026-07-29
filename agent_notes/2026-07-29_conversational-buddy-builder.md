# Conversational Buddy Builder

## Product contract

The first card in `/buddies` is always a minimal `New` action. It opens a
normal, persisted conversation instead of a form or a hidden administrator
Buddy. The user describes the role they want; the Builder asks only for
materially missing information, creates the Buddy, and renders a result card
with `Open Buddy` and `Start conversation`.

## Data and runtime design

- `Conversation.purpose = 'buddy_builder'` is the single durable discriminator.
  It survives an empty-thread refresh and server restart through conversation
  creation metadata.
- Purpose selects both the invisible first-turn briefing and the Builder MCP
  profile. There is no second chat runtime and no synthetic Buddy in the
  directory.
- Builder conversations run Codex with `gpt-5.6-luna` and `high` reasoning.
- The Builder MCP exposes only `list_workspaces`, `list_buddies`, and
  `create_buddy`. Ordinary and Buddy-owned conversations never receive these
  tools.
- Creation is limited to identity, one home workspace, and an execution
  profile. Managers, files, skills, automations, extra permissions, sends, and
  production changes remain outside this flow.
- The trusted Builder conversation ID is the durable idempotency key. A retry
  of the same normalized request replays the same Buddy; a changed request or
  workspace conflicts. The model cannot supply or replace the key.

## Result contract

`create_buddy` returns the canonical created record in structured content and
an existing text-envelope compatibility block:

```text
<!-- unleashd:buddy-created -->
{"type":"buddy_created","buddy":{...},"route":"/buddies/:id"}
<!-- /unleashd:buddy-created -->
```

The client accepts the block only when the route exactly matches the returned
Buddy ID. It removes the envelope from prose and renders the dedicated card.
Starting a conversation resolves the Buddy's canonical workspace and runtime
profile through the existing Buddy detail flow. The temporary query flag is
removed before navigation so browser Back cannot create duplicate chats.

## Review decisions

- Rejected a hidden Builder Buddy because it pollutes organizational state and
  would inherit the wrong tool permissions.
- Rejected a modal/form wizard because it duplicates conversational inference
  and adds another creation model.
- Rejected arbitrary tool expansion because hiring a Buddy should not silently
  configure scheduled or external side effects.
- Kept the provider event protocol unchanged; this feature is an application
  concern, not a new generic agent-runtime event.

## Focused validation

- `New` remains first with zero or many Buddies.
- Blank Builder threads recover after browser/server refresh.
- Builder tool access is exactly the three scoped operations.
- Missing workspace, invalid model/effort, and changed retries fail before a
  second Buddy is created.
- Successful retries return the same Buddy.
- The result card survives persisted transcript reload, opens the Buddy, and
  starts a correctly profiled conversation once.
