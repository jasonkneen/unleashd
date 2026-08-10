#!/usr/bin/env bash
# check-client-invariants.sh — 3 grep gates for Mobile PWA (§12, PLANNING_MOBILE.md §12)
# Fails CI if any invariant is violated. Zero custom plugins — stock grep only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

echo "==> Gate G1: jotaiStore.set outside client/src/atoms/ — components call actions, never write atoms"
# Allowlist: only files under client/src/atoms/ may call jotaiStore.set
# mutate.ts wraps jotaiStore.set inside atoms/ — allowed; everything outside must be zero.
if grep -R --include="*.ts" --include="*.tsx" -n "jotaiStore\.set" client/src 2>/dev/null | grep -v "client/src/atoms/" | grep -v "node_modules" ; then
  echo "G1 FAIL: jotaiStore.set found outside client/src/atoms/. Components must call actions, never write atoms directly."
  echo "  Fix: move the write into an action in client/src/atoms/actions.ts or use mutate() helper."
  FAIL=1
else
  echo "G1 PASS"
fi
echo

echo "==> Gate G2: raw .buddyContext / .purpose reads in client/src/mobile/ — use getConversationKind()"
# All mobile code must read BuddyContext via getConversationKind/matchConversationKind/buddyContextFromKind
# (conversation-kind.ts), never raw field access. One-allowed consumer is components/buddies/buddies-shaping.ts
# which is outside mobile/. Zero hits expected in mobile/.
# Exclude parsed.*.purpose from buddy-review-message parser (pure helper, not Conversation.purpose).
if grep -R --include="*.ts" --include="*.tsx" -n "\.buddyContext\|\.purpose" client/src/mobile 2>/dev/null | grep -v "parsed\.purpose" | grep -v "parsed\.subjectBuddyId" | grep -v "No raw \.buddyContext" ; then
  echo "G2 FAIL: raw .buddyContext or .purpose read in client/src/mobile/. Use getConversationKind() / buddyContextFromKind()."
  FAIL=1
else
  echo "G2 PASS"
fi
echo

echo "==> Gate G3: components/*.tsx imports in mobile/ — except components/buddies/*"
# mobile/ may import atoms/*, hooks/*, utils/*, shared/*, components/buddies/* — never other components/*.tsx
# Parsers now live in utils/, not components/. CSS side-effect imports from components would couple trees.
# Allow: components/buddies/{api,types,ui-contract,buddies-shaping}.ts — co-located shaping, not view trees.
# Detect any import that mentions "components/" inside mobile/ and does NOT contain "components/buddies".
# Also exclude mobile's own internal components (mobile/components/*, mobile/index.ts barrel) — only
# ban imports that reach the desktop tree (client/src/components/* outside buddies/).
# Pure .ts parsers (buddy-review-message, structured-message-segments) are allowed — they are
# logic, not view trees, and have no CSS side-effects (see PLANNING §6 reuse inventory).
if grep -R --include="*.ts" --include="*.tsx" -n "components/" client/src/mobile 2>/dev/null \
  | grep -v "components/buddies" \
  | grep -v "components/buddy-review-message" \
  | grep -v "components/structured-message-segments" \
  | grep -v "mobile/components" \
  | grep -v "from './components" \
  | grep -v 'from "./components' \
  | grep -v "from '../components" \
  | grep -v 'from "../components' \
  | grep -v "never from components" \
  | grep -v "node_modules" ; then
  echo "G3 FAIL: mobile/ imports from components/* outside components/buddies/. Move shared logic to utils/ or atoms/."
  echo "  Allowed: components/buddies/{api,types,ui-contract,buddies-shaping}.ts only."
  FAIL=1
else
  echo "G3 PASS"
fi
echo

if [ "$FAIL" -ne 0 ]; then
  echo "check-client-invariants: FAILED — fix the gates above."
  exit 1
fi

echo "check-client-invariants: all 3 gates PASS"
