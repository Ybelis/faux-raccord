#!/bin/sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Node.js 24 ou plus récent est nécessaire : https://nodejs.org'
  exit 1
fi
exec node "$PROJECT_DIR/scripts/launch.mjs" "$@"
