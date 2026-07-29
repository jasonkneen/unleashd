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
- Creation is limited to identity, a home workspace, explicit additional
  workspace assignments, and an execution profile. Managers, files, skills,
  automations, extra permissions, sends, and production changes remain outside
  this flow.
- The trusted Builder conversation ID is the durable idempotency key. A retry
  of the same normalized request replays the same Buddy; a changed request or
  workspace conflicts. The model cannot supply or replace the key.

## Result contract

`create_buddy` returns the canonical created record in structured content and
persists the same record atomically with the Buddy and workspace assignments.
The Builder conversation ID keys that record. After the turn completes, the
client reads `GET /api/buddies/builder/:conversationId/result`, validates the
shared schema, and renders the dedicated card. The model only confirms the hire
in ordinary prose; it never transports application state in a magic marker.

Starting a conversation uses the result's canonical workspace and runtime
profile directly through the existing conversation action. There is no
temporary query flag or second detail-page lifecycle, so browser Back cannot
create duplicate chats.

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
- The result card survives server restart without reparsing the transcript,
  opens the Buddy, and starts a correctly profiled conversation once.
