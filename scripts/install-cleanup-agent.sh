#!/usr/bin/env bash
# Install (or remove) a macOS LaunchAgent that runs scripts/cleanup.sh every
# 15 minutes. The agent survives reboots and does not need a terminal open.
#
#   ./scripts/install-cleanup-agent.sh
#   ./scripts/install-cleanup-agent.sh --uninstall
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.mrun-face-platform.cleanup"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed $LABEL"
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO/scripts/cleanup.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO</string>
  <key>StartInterval</key>
  <integer>900</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$HOME/Library/Logs/mrun-cleanup.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME/Library/Logs/mrun-cleanup.log</string>
</dict>
</plist>
EOF

# bootout fails harmlessly when the agent is not loaded yet.
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl enable "$DOMAIN/$LABEL"

echo "Installed $LABEL — runs every 15 minutes"
echo "  plist: $PLIST"
echo "  log:   $HOME/Library/Logs/mrun-cleanup.log"
echo "  stop:  ./scripts/install-cleanup-agent.sh --uninstall"
