#!/usr/bin/env bash
# Rebuilds assets/build.js from the sources in src/.
#
# index.html loads only assets/build.js (plus the third-party libraries in assets/),
# so every change made in src/ has to be followed by running this script.
# The order matters: encedo.js defines the Encedo class used by core2.js,
# and scopes.js defines the _scopes/_endpoints tables read at runtime.
set -euo pipefail
cd "$(dirname "$0")"

SOURCES=(src/encedo.js src/core2.js src/scopes.js)
OUT=assets/build.js

for f in "${SOURCES[@]}"; do
	node --check "$f"
done

{
	for f in "${SOURCES[@]}"; do
		printf '/* ---- %s ---- */\n' "$f"
		cat "$f"
		printf '\n'
	done
} > "$OUT"

node --check "$OUT"
printf 'built %s (%s bytes, %s lines)\n' "$OUT" "$(wc -c < "$OUT")" "$(wc -l < "$OUT")"
