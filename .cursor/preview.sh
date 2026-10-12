#!/usr/bin/env bash
# Serve the static site for Cloud Agent preview. Does not modify files.
set -euo pipefail

PORT=8000
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f index.html ]]; then
  echo "index.html not found in ${ROOT}" >&2
  exit 1
fi

if python3 - "$PORT" <<'PY'
import sys
import urllib.request

port = sys.argv[1]
try:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2) as response:
        raise SystemExit(0 if response.status == 200 else 1)
except Exception:
    raise SystemExit(1)
PY
then
  echo "Mesa preview already serving http://127.0.0.1:${PORT}/"
  exit 0
fi

echo "Starting Mesa preview at http://127.0.0.1:${PORT}/"
exec python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$ROOT"
