#!/usr/bin/env bash
# Install a persistent, loopback-only port proxy for:
#   http://unleashd.localhost → http://127.0.0.1:7489
#
# The installed helper binds port 80 as root, immediately drops to `nobody`,
# and then proxies raw TCP. Unleashd and Node always run as the normal user.

set -euo pipefail

DOMAIN="unleashd.localhost"
TARGET_PORT=7489
LABEL="com.unleashd.local-domain"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_SOURCE="${SCRIPT_DIR}/local-port-proxy.c"
HELPER="/Library/PrivilegedHelperTools/com.unleashd.local-port-proxy"
PLIST="/Library/LaunchDaemons/${LABEL}.plist"
HOSTS_FILE="/etc/hosts"
HOSTS_LINE="127.0.0.1 ${DOMAIN}"

# Legacy PF paths from the original implementation.
PF_ANCHOR_NAME="com.unleashd"
PF_ANCHOR_FILE="/etc/pf.anchors/${PF_ANCHOR_NAME}"
PF_CONFIG="/etc/pf.conf"

TEMP_PROXY=""
TEMP_PF_CONFIG=""
cleanup() {
  [[ -z "${TEMP_PROXY}" ]] || rm -f "${TEMP_PROXY}"
  [[ -z "${TEMP_PF_CONFIG}" ]] || rm -f "${TEMP_PF_CONFIG}"
}
trap cleanup EXIT

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Local-domain setup currently supports macOS only." >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "This installer requires administrator permission. Run it with sudo." >&2
  exit 1
fi

remove_legacy_pf_setup() {
  if ! grep -qF "${PF_ANCHOR_NAME}" "${PF_CONFIG}" && [[ ! -f "${PF_ANCHOR_FILE}" ]]; then
    return
  fi

  TEMP_PF_CONFIG="$(mktemp /tmp/unleashd-pf.XXXXXX)"
  sed \
    -e "/^[[:space:]]*rdr-anchor \"${PF_ANCHOR_NAME}\"[[:space:]]*$/d" \
    -e "/^[[:space:]]*load anchor \"${PF_ANCHOR_NAME}\" from/d" \
    "${PF_CONFIG}" > "${TEMP_PF_CONFIG}"
  pfctl -nf "${TEMP_PF_CONFIG}"
  install -o root -g wheel -m 644 "${TEMP_PF_CONFIG}" "${PF_CONFIG}"
  rm -f "${PF_ANCHOR_FILE}"
  pfctl -f "${PF_CONFIG}"
}

stop_proxy() {
  launchctl bootout "system/${LABEL}" >/dev/null 2>&1 || true
}

remove_setup() {
  stop_proxy
  rm -f "${PLIST}" "${HELPER}"
  sed -i '' "\\|^${HOSTS_LINE}$|d" "${HOSTS_FILE}"
  remove_legacy_pf_setup
  echo "Removed http://${DOMAIN} routing."
}

install_setup() {
  remove_legacy_pf_setup
  stop_proxy

  TEMP_PROXY="$(mktemp /tmp/unleashd-local-port-proxy.XXXXXX)"
  /usr/bin/clang -O2 -Wall -Wextra -Werror "${PROXY_SOURCE}" -o "${TEMP_PROXY}"
  install -o root -g wheel -m 755 "${TEMP_PROXY}" "${HELPER}"

  cat > "${PLIST}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${HELPER}</string>
    <string>${TARGET_PORT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>/var/log/unleashd-local-domain.log</string>
  <key>StandardErrorPath</key>
  <string>/var/log/unleashd-local-domain.log</string>
</dict>
</plist>
EOF
  chown root:wheel "${PLIST}"
  chmod 644 "${PLIST}"
  plutil -lint "${PLIST}" >/dev/null

  sed -i '' "\\|^${HOSTS_LINE}$|d" "${HOSTS_FILE}"
  printf '%s\n' "${HOSTS_LINE}" >> "${HOSTS_FILE}"

  launchctl bootstrap system "${PLIST}"
  launchctl kickstart -k "system/${LABEL}"

  local attempt
  for attempt in {1..30}; do
    if nc -z 127.0.0.1 80 >/dev/null 2>&1; then
      echo "Ready: http://${DOMAIN} forwards to http://127.0.0.1:${TARGET_PORT}"
      return
    fi
    sleep 0.1
  done

  echo "The local port proxy did not start. launchd status:" >&2
  launchctl print "system/${LABEL}" >&2 || true
  tail -30 /var/log/unleashd-local-domain.log >&2 || true
  exit 1
}

case "${1:-install}" in
  install)
    install_setup
    ;;
  remove|uninstall|--remove|-r)
    remove_setup
    ;;
  *)
    echo "Usage: sudo bash $0 [install|remove]" >&2
    exit 2
    ;;
esac
