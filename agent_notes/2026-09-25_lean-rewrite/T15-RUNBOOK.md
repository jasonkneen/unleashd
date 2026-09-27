# T15: switch the live install to the verified lean release

Updated 2026-09-27. This replaces the v33-only instructions and historical queue-cancellation
recommendations. The owner already authorized stop/import/restart, including ending active
turns. No further user decision is needed. Preserve every queued background record. A failed
code/data gate is a technical stop, not a request for another permission.

The live source is schema **34**. Importer d553cf4 (integration cherry 5625ca2) accepts exactly
33/34 with matching physical schema, preserves public-channel archive timestamps and builder
hire provenance, and verifies both. See [T15-v34-rehearsal.md](T15-v34-rehearsal.md). Run these
blocks in one **bash** shell. Stop at any failure and preserve artifacts for diagnosis.

## 0. Prepare pinned release and rollback checkouts

Use a clean, final-gated release checkout outside the watched live checkout, and a separate
clean legacy rollback checkout. Record exact SHAs; moving branches/cached binaries are not
release identities. Pin legacy rollback to **086c097**, the clean v34-capable legacy tree. Parent traced the
September 26 backend launch to root 028bbc0, but that older package may not open today's v34
DB. The rollback is therefore a verified compatible legacy build, not a claim to reproduce
the earlier in-memory source. Other sessions can edit the owner checkout independently.

```bash
set -euo pipefail
umask 077
export T15_RELEASE=/absolute/path/to/final-gated-release
export T15_ROLLBACK=/absolute/path/to/prepared-legacy-rollback
export T15_DATA="${UNLEASHD_DATA_DIR:-$HOME/.agent-viewer}"
export T15_SOURCE="$HOME/.buddies/buddies.sqlite"
export T15_B3="${UNLEASHD_BUDDIES_DB:-$HOME/.buddies/buddies-v3.sqlite}"
export T15_CR="$T15_DATA/conversation-records.sqlite"
export T15_BACKUP="$HOME/unleashd-t15-backup-$(date +%Y%m%dT%H%M%S)"
mkdir "$T15_BACKUP"
test -z "$(git -C "$T15_RELEASE" status --porcelain)"
test -z "$(git -C "$T15_ROLLBACK" status --porcelain)"
git -C "$T15_RELEASE" rev-parse HEAD > "$T15_BACKUP/release.sha"
git -C "$T15_ROLLBACK" rev-parse HEAD > "$T15_BACKUP/rollback.sha"
```

Confirm environment/data roots and port overrides match the install (defaults Vite 7489/API
7499). Prepare legacy rollback with frozen offline install, submodule build, shared build and
typecheck; inspect installed `@nbardy/buddies/src/lists.js` for the v34 `archived_at` migration.
Same-name vendor tarballs can leave stale extracts. Never run its Buddies CLI against live home.
Prepare release with `pnpm run bootstrap` and final code gates. No watched-tree merge/build.

```bash
cd "$T15_RELEASE"
export CARGO_TARGET_DIR="$HOME/.cache/unleashd/t15-release-target"
cargo build --manifest-path crates/Cargo.toml -p unleashd-buddies-import -p unleashd-records-tool
export BI="$CARGO_TARGET_DIR/debug/buddies-import"
export RT="$CARGO_TARGET_DIR/debug/records-tool"
shasum -a 256 "$BI" "$RT" > "$T15_BACKUP/importer-binaries.sha256"
mkdir -p "$T15_BACKUP/export-check/src"
cp agent_notes/2026-09-25_lean-rewrite/export-manifest.rs "$T15_BACKUP/export-check/src/main.rs"
python3 - <<'PY'
import json, os
from pathlib import Path
r, b = Path(os.environ['T15_RELEASE']), Path(os.environ['T15_BACKUP'])
q = lambda p: json.dumps(str(p))
(b/'export-check/Cargo.toml').write_text(
    '[package]\nname="t15-export-manifest"\nversion="0.1.0"\nedition="2024"\n'
    '[dependencies]\nserde_json="1"\n'
    'unleashd-buddies-import={path='+q(r/'crates/unleashd-buddies-import')+'}\n'
    'unleashd-buddies={path='+q(r/'crates/unleashd-buddies')+',default-features=false}\n')
PY
cargo build --offline --manifest-path "$T15_BACKUP/export-check/Cargo.toml"
export EM="$CARGO_TARGET_DIR/debug/t15-export-manifest"
```

## 1. Record active work, then stop the supervisor once

Prefer a naturally idle opportunity. Source reload waits indefinitely for conversations,
schedulers, mutations and startup to become idle, pauses scheduling and rechecks before exit;
the watcher immediately replaces the backend. It is **not** a drain-and-stop command.
Explicit SIGINT/SIGTERM stops scheduling and interrupts active conversations with
`server_restart` plus a persisted system message, allows 3 seconds for release, then flushes
(5-second watchdog; both grace periods configurable). Legacy scheduler stop also cancels its
active automation runs and stops reviewers. Record those outcomes, not natural completion.

Capture active conversation IDs from existing UI/WS init (`isRunning`) and scheduler
`GET /api/buddies/automations/health`. Record any process-local pending foreground messages
separately: those are not durable background rows and cannot automatically resume on restart.

```bash
sqlite3 -readonly -json "$T15_SOURCE" \
  "SELECT id,input_kind,conversation_id,status FROM buddy_runs WHERE status IN ('queued','running','cancel_requested')" \
  > "$T15_BACKUP/buddy-work-before-stop.json"
sqlite3 -readonly -json "$T15_SOURCE" \
  "SELECT id,conversation_id,status FROM buddy_automation_runs WHERE status IN ('queued','running','claimed')" \
  > "$T15_BACKUP/automation-work-before-stop.json"
cp "$T15_DATA/dev-supervisor.lock.json" "$T15_BACKUP/supervisor-before-stop.json"
T15_PID=$(jq -er '.pid' "$T15_BACKUP/supervisor-before-stop.json")
ps -p "$T15_PID" -o pid,ppid,lstart,command
# Check this is the current dev-supervisor owner, then send ONE signal:
kill -INT "$T15_PID"
```

Wait for supervisor/backend exit. Do not signal only backend (watcher restarts it), use
`dev:replace` (force-kills after ten seconds), or send a second signal (escalates). Verify no
listeners on 7489/7499 and no handles on source DB/WAL with `lsof`; investigate any remaining
owner before proceeding. A timeout is not permission to force-kill. Keep shutdown logs.

## 2. Freeze source, config, reads and reviewer receipts

SQLite opens source read-only, including WAL; backup creates a consistent copy. No legacy Store
or CLI is instantiated. APFS clones are independent copies. Config migration uses a second clone.

```bash
python3 - <<'PY'
import os, sqlite3
from pathlib import Path
s, b = Path(os.environ['T15_SOURCE']), Path(os.environ['T15_BACKUP'])
with sqlite3.connect(s.as_uri()+'?mode=ro', uri=True) as old:
    old.execute('PRAGMA query_only=ON')
    assert old.execute('PRAGMA user_version').fetchone()[0] == 34
    with sqlite3.connect(b/'buddies-v34.sqlite') as new:
        old.backup(new)
        assert new.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
PY
for entry in conversation-config session-cache-v1 memory-reviews; do
  cp -c -R "$T15_DATA/$entry" "$T15_BACKUP/$entry"
done
if test -f "$T15_DATA/owner-channel-reads.json"; then
  cp -c "$T15_DATA/owner-channel-reads.json" "$T15_BACKUP/owner-channel-reads.json"
else
  printf 'absent at cutover\n' > "$T15_BACKUP/owner-channel-reads.absent"
fi
python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
b = Path(os.environ['T15_BACKUP'])
roots = ['buddies-v34.sqlite','conversation-config','session-cache-v1','memory-reviews','owner-channel-reads.json']
files = [f for name in roots for f in ([b/name] if (b/name).is_file() else sorted((b/name).rglob('*'))) if f.is_file()]
hashes = {}
for f in files:
    with f.open('rb') as stream:
        hashes[str(f.relative_to(b))] = hashlib.file_digest(stream,'sha256').hexdigest()
(b/'source-files.sha256.json').write_text(json.dumps(hashes, indent=2)+'\n')
PY
export T15_OLD="$T15_BACKUP/buddies-v34.sqlite"
export COPY_DATA="$T15_BACKUP/records-import"
mkdir "$COPY_DATA"
cp -c -R "$T15_BACKUP/conversation-config" "$COPY_DATA/conversation-config"
ln -s "$T15_BACKUP/session-cache-v1" "$COPY_DATA/session-cache-v1"
for target in "$T15_B3" "$T15_B3-wal" "$T15_B3-shm" "$T15_CR" "$T15_CR-wal" "$T15_CR-shm"; do
  test ! -e "$target"  # existing target requires diagnosis, never automatic deletion
done
"$EM" plan "$T15_OLD" "$T15_BACKUP/export-manifest.json"
```

Compare stopped snapshot statuses with pre-stop IDs to record shutdown changes. Soul files are
never modified by importer/verify. Other editors may still change them while backend is stopped,
so soul verification remains mandatory; snapshot their bytes too if needed for rollback evidence.

## 3. Import and verify without queue edits

```bash
"$BI" import --from "$T15_OLD" --to "$T15_B3" --report "$T15_BACKUP/buddies.import.json" \
  --owner-reads "$T15_BACKUP/owner-channel-reads.json"
cd "$T15_RELEASE"
pnpm --dir server exec tsx src/conversations/record-migration.ts "$COPY_DATA"
jq -e '.failures | length == 0' "$COPY_DATA/conversation-config/v1/migration-v2-report.json"
test -d "$COPY_DATA/conversation-config/v1/by-conversation"
"$RT" import "$COPY_DATA/conversation-config/v1" "$T15_CR"
"$BI" verify --from "$T15_OLD" --to "$T15_B3" \
  --import-report "$T15_BACKUP/buddies.import.json" --out "$T15_BACKUP/buddies.verify.json"
"$RT" verify "$COPY_DATA/conversation-config/v1" "$T15_CR"
jq -e '.source_version == 34' "$T15_BACKUP/buddies.import.json"
jq -e '.ok == true' "$T15_BACKUP/buddies.verify.json" "$T15_CR.verify.json"
cp "$T15_CR.import.json" "$T15_CR.verify.json" "$T15_BACKUP/"
sqlite3 -readonly -json "$T15_B3" \
  "SELECT id,input_kind,conversation_id,status FROM run WHERE status IN ('queued','running','cancel_requested')" \
  > "$T15_BACKUP/imported-work-before-start.json"
```

Check every verifier class, archive timestamps, builder hires, run identities/statuses and
record rejects. Corrupt JSON is preserved byte-exact as a reject; migration `failures` must be
empty. Import preserves queued/running state and lease/policy/provenance fields. Retired legacy
tables remain in backup; `dropped_tables` inventories them. The established importer default
marks DMs read; public owner cursors come from backed-up reads. Do not silently change policy.

## 4. Export notes/older memory, then hash actual files

```bash
"$BI" export-notes --from "$T15_OLD" > "$T15_BACKUP/export-plan.txt"
"$BI" export-notes --from "$T15_OLD" --write > "$T15_BACKUP/export-write.txt"
"$EM" verify "$T15_OLD" "$T15_BACKUP/export-manifest.json" | tee "$T15_BACKUP/export-verify.txt"
python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
b = Path(os.environ['T15_BACKUP'])
for relative, expected in json.loads((b/'source-files.sha256.json').read_text()).items():
    with (b/relative).open('rb') as f:
        assert hashlib.file_digest(f,'sha256').hexdigest() == expected, relative
print('frozen source/config/cache/receipts/read hashes unchanged')
PY
```

DB verification checks archive counts, not exported bytes. The companion uses the importer's
canonical renderer, binds its manifest to source SHA, and hashes every actual export. Export
refuses existing destinations. IO failure may leave partial output: retain manifest, inspect
listed files, and move only exact hash-matching exports to recovery storage before retrying.
Never overwrite/delete a preexisting or edited note to make a retry pass.

## 5. Start the pinned release; inspect recovery

```bash
cd "$T15_RELEASE"
test "$(git rev-parse HEAD)" = "$(cat "$T15_BACKUP/release.sha")"
pnpm dev 2>&1 | tee "$T15_BACKUP/first-start.log"
```

Normal `pnpm dev` refuses another owner, ensures addons and starts backend/Vite after initial
compiler passes. Startup settles residual `running` runs as `failed/interrupted`, settles
`cancel_requested` as cancelled, and clears their leases. Queued foreground `chat` rows become
`cancelled/interrupted` because the old process queue died. **Queued background rows survive**
and are claimed subject to background enablement, capacity and task state; held rows stay
queued. Due schedules resume. Recovery may generate ordinary failure-return work. Do not
invoke `recoverRuns` manually before startup.

Save recovery/abandoned-chat counts; reconcile imported active/queued IDs with current history
(completed background work need not still be queued). Record interrupted conversations,
automations and reviewer receipts. Check sidebar history, channels including archives, DMs,
Memory docs/notes, owner cursors and one authorized Buddy DM reply. Run
`pnpm errors:list --limit=30` (never open the journal directly). Reload desktop/phone tabs:
old v2 tabs cannot recover from the new protocol's 4426 close themselves. Save startup timing
and API/UI observations.

## Rollback or retry

Stop the new supervisor once, wait for handles/listeners to close, then start `pnpm dev` in the
pinned prebuilt **legacy rollback checkout** with the original environment/data root. Verify
its SHA and installed v34 package. Source DB/config were never replaced: no revert of a guessed
merge commit, reset, stash, live restore or dependency guessing. Keep new DBs, sidecars, reports
and exported files for diagnosis. Post-switch writes live only in new stores; retain them for
deliberate reconciliation, not a claim that rollback merges them back.

For retry, with every owner stopped, move only exact new DB/sidecar paths to a uniquely named
recovery folder (no wildcard deletion). Recheck exports with the manifest. Take a new source
snapshot if legacy ran again. Never import into a target a server has opened. Historical lost
reviews remain lost history; migration preserves receipts and restores the unified memory
path, but cannot invent missing review output.
