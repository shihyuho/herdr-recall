#!/usr/bin/env bash
# Copies the Recall mod into the Herdr app's home and checks it.
#
# A copy, not a symlink. Herdr before 0.1.15 loads no icons from a linked mod
# folder, and whether it reloads a linked folder when a file is saved is
# unverified. The agent install route copies anyway. Re-run after editing.
# The app writes its own type files into the mod folder; they are kept.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
app_home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
dest="$app_home/mods/recall"

mkdir -p "$app_home/mods"
if [ -L "$dest" ]; then rm "$dest"; fi
rsync -a --delete \
  --exclude gpui-kit.d.ts --exclude herdr.d.ts --exclude jsconfig.json \
  "$here/mods/recall/" "$dest/"
herdr-app check "$dest"

cat <<EOF

Installed to $dest
Bind keys in $app_home/keys.json (see keys.json in this repo), then press
your open key once: that starts the tracker, which then runs on every start.
EOF
