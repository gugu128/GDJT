#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT_DIR="${ROOT_DIR}/artifacts"
OUT_FILE="${1:-${OUT_DIR}/screen.png}"
PROFILE_DIR="/private/tmp/gdjt-chrome-headless-profile"
CHROME_PID=""
VIEWPORT="${VIEWPORT:-1678,917}"

if [[ ! -x "${CHROME}" ]]; then
  echo "Google Chrome was not found at: ${CHROME}" >&2
  exit 1
fi

mkdir -p "$(dirname "${OUT_FILE}")"
rm -rf "${PROFILE_DIR}"
rm -f "${OUT_FILE}"

FILE_URL="$(python3 -c 'import pathlib, urllib.parse; print(pathlib.Path("'"${ROOT_DIR}"'/index.html").absolute().as_uri())')"

cleanup() {
  if [[ -n "${CHROME_PID}" ]] && kill -0 "${CHROME_PID}" >/dev/null 2>&1; then
    kill "${CHROME_PID}" >/dev/null 2>&1 || true
  fi
  pkill -f "${PROFILE_DIR}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

"${CHROME}" \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  --disable-component-update \
  --disable-sync \
  --disable-extensions \
  --disable-default-apps \
  --disable-popup-blocking \
  --log-level=3 \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=1200 \
  --user-data-dir="${PROFILE_DIR}" \
  --window-size="${VIEWPORT}" \
  --screenshot="${OUT_FILE}" \
  "${FILE_URL}" &

CHROME_PID="$!"

for _ in {1..80}; do
  if [[ -s "${OUT_FILE}" ]]; then
    sleep 0.5
    echo "Screenshot written to ${OUT_FILE}"
    exit 0
  fi
  if ! kill -0 "${CHROME_PID}" >/dev/null 2>&1; then
    wait "${CHROME_PID}"
    break
  fi
  sleep 0.25
done

echo "Chrome did not produce a screenshot: ${OUT_FILE}" >&2
exit 1
