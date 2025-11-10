#!/bin/sh
set -e

OUTPUT="/usr/share/nginx/html/env-config.js"
BASE_URL="${GAME_API_BASE_URL:-${VITE_GAME_API_BASE_URL:-}}"
BASE_URL="${BASE_URL%/}"

escaped_base_url=$(printf '%s' "$BASE_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')

{
  echo 'window.__ENV__ = window.__ENV__ || {};'
  printf 'window.__ENV__.VITE_GAME_API_BASE_URL = "%s";\n' "$escaped_base_url"
} > "$OUTPUT"
