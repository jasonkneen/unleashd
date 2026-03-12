#!/usr/bin/env bash
# setup-domain.sh — Configure unleashd.dev to resolve locally and forward port 80 → 7489
#
# What it does:
#   1. Adds "127.0.0.1 unleashd.dev" to /etc/hosts (if not already present)
#   2. Creates a pf (packet filter) anchor to redirect port 80 → 7489
#   3. Loads the pf rule so http://unleashd.dev works without typing a port
#
# Usage:
#   sudo bash tools/setup-domain.sh          # install
#   sudo bash tools/setup-domain.sh --remove  # uninstall
#
# Requires: macOS (uses pf). For Linux, swap pf for iptables.

set -euo pipefail

DOMAIN="unleashd.dev"
DEV_PORT=7489
TARGET_PORT=7489
HOSTS_LINE="127.0.0.1 ${DOMAIN}"
PF_ANCHOR_NAME="com.unleashd"
PF_ANCHOR_FILE="/etc/pf.anchors/${PF_ANCHOR_NAME}"

if [[ $EUID -ne 0 ]]; then
  echo "This script requires root. Run with: sudo $0"
  exit 1
fi

remove() {
  echo "Removing ${DOMAIN} domain setup..."

  # Remove hosts entry
  if grep -qF "${HOSTS_LINE}" /etc/hosts; then
    sed -i '' "/${DOMAIN}/d" /etc/hosts
    echo "  ✓ Removed ${DOMAIN} from /etc/hosts"
  else
    echo "  - ${DOMAIN} not in /etc/hosts, skipping"
  fi

  # Remove pf anchor file
  if [[ -f "${PF_ANCHOR_FILE}" ]]; then
    rm "${PF_ANCHOR_FILE}"
    echo "  ✓ Removed ${PF_ANCHOR_FILE}"
  fi

  # Remove anchor from pf.conf if present
  if grep -qF "${PF_ANCHOR_NAME}" /etc/pf.conf; then
    sed -i '' "/${PF_ANCHOR_NAME}/d" /etc/pf.conf
    echo "  ✓ Removed anchor from /etc/pf.conf"
  fi

  # Reload pf
  pfctl -f /etc/pf.conf 2>/dev/null || true
  echo "  ✓ Reloaded pf"
  echo "Done. ${DOMAIN} is no longer configured."
}

install() {
  echo "Setting up ${DOMAIN} → 127.0.0.1:${TARGET_PORT}..."

  # Step 1: /etc/hosts
  if grep -qF "${HOSTS_LINE}" /etc/hosts; then
    echo "  - /etc/hosts already has ${DOMAIN}, skipping"
  else
    echo "${HOSTS_LINE}" >> /etc/hosts
    echo "  ✓ Added ${DOMAIN} to /etc/hosts"
  fi

  # Step 2: pf anchor file (port 80 → TARGET_PORT)
  cat > "${PF_ANCHOR_FILE}" <<EOF
rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 80 -> 127.0.0.1 port ${TARGET_PORT}
EOF
  echo "  ✓ Created ${PF_ANCHOR_FILE}"

  # Step 3: Wire anchor into pf.conf if not already present
  if grep -qF "${PF_ANCHOR_NAME}" /etc/pf.conf; then
    echo "  - pf.conf already references ${PF_ANCHOR_NAME}, skipping"
  else
    # Insert anchor lines before the last line (which is typically a default rule)
    # We need both the rdr-anchor and load anchor directives
    {
      echo "rdr-anchor \"${PF_ANCHOR_NAME}\""
      echo "load anchor \"${PF_ANCHOR_NAME}\" from \"${PF_ANCHOR_FILE}\""
    } >> /etc/pf.conf
    echo "  ✓ Added anchor to /etc/pf.conf"
  fi

  # Step 4: Enable and reload pf
  pfctl -ef /etc/pf.conf 2>/dev/null || pfctl -f /etc/pf.conf 2>/dev/null || true
  echo "  ✓ Loaded pf rules"

  echo ""
  echo "Done! You can now access:"
  echo "  http://${DOMAIN}        (dev / pnpm dev, production / pnpm start)"
  echo ""
  echo "To remove: sudo $0 --remove"
}

case "${1:-}" in
  --remove|-r|remove|uninstall)
    remove
    ;;
  *)
    install
    ;;
esac
