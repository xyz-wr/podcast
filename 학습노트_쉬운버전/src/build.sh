#!/usr/bin/env bash
# HTML 원고(ch2.html, ch3.html)를 PDF로 변환한다. 사용법: bash src/build.sh
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null || pwd)"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROFILE="${TEMP:-/tmp}/notes-pdf-chrome-profile"
for n in 2 3; do
  MSYS_NO_PATHCONV=1 "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
    --user-data-dir="$PROFILE" --virtual-time-budget=5000 \
    --print-to-pdf="$DIR/주니어백엔드_${n}장_학습노트_쉬운버전.pdf" \
    "file:///$DIR/src/ch${n}.html" 2>&1 | grep "bytes written" || true
done
