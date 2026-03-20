#!/usr/bin/env bash
# build/icon.png -> build/icon.icns (macOS only, Xcode iconutil)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/build/icon.png"
SET="$ROOT/build/app.iconset"
OUT="$ROOT/build/icon.icns"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "make-icns: skip (not macOS)"
  exit 0
fi

if [[ ! -f "$SRC" ]]; then
  echo "make-icns: missing $SRC"
  exit 1
fi

rm -rf "$SET"
mkdir -p "$SET"

sips -z 16 16     "$SRC" --out "$SET/icon_16x16.png"
sips -z 32 32     "$SRC" --out "$SET/icon_16x16@2x.png"
sips -z 32 32     "$SRC" --out "$SET/icon_32x32.png"
sips -z 64 64     "$SRC" --out "$SET/icon_32x32@2x.png"
sips -z 128 128   "$SRC" --out "$SET/icon_128x128.png"
sips -z 256 256   "$SRC" --out "$SET/icon_128x128@2x.png"
sips -z 256 256   "$SRC" --out "$SET/icon_256x256.png"
sips -z 512 512   "$SRC" --out "$SET/icon_256x256@2x.png"
sips -z 512 512   "$SRC" --out "$SET/icon_512x512.png"
sips -z 1024 1024 "$SRC" --out "$SET/icon_512x512@2x.png"

iconutil -c icns "$SET" -o "$OUT"
rm -rf "$SET"
echo "make-icns: wrote $OUT"
