#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
port="${PORT:-8000}"
printf 'NEON RIOT — open http://localhost:%s\nPress Ctrl+C to stop.\n' "$port"
exec python3 -m http.server "$port" --bind 127.0.0.1
