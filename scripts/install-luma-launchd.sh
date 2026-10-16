#!/bin/zsh
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
node="$(command -v node)"
plist="$HOME/Library/LaunchAgents/com.anishthite.sfevents-luma.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.anishthite.sfevents-luma</string>
<key>ProgramArguments</key><array><string>$node</string><string>$root/scripts/collect-luma.mjs</string></array>
<key>StartCalendarInterval</key><dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>$HOME/Library/Logs/sfevents-luma.log</string>
<key>StandardErrorPath</key><string>$HOME/Library/Logs/sfevents-luma.err.log</string>
</dict></plist>
EOF
launchctl bootout "gui/$(id -u)" "$plist" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"
echo "Installed $plist (daily at 10:00 local time, while Mac is awake)"
