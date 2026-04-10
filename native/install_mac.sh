#!/bin/bash
# DORA Native Messaging Host 설치 스크립트 (macOS)
#
# 사용법:
#   1. Chrome 확장 프로그램을 먼저 로드한 뒤 Extension ID를 확인한다.
#      (chrome://extensions 에서 "DORA" 카드의 ID 복사)
#   2. 아래 명령으로 실행한다:
#      chmod +x install_mac.sh && ./install_mac.sh <EXTENSION_ID>
#
# 예시:
#   ./install_mac.sh abcdefghijklmnopqrstuvwxyz123456

set -e

EXTENSION_ID="$1"

if [ -z "$EXTENSION_ID" ]; then
  echo "❌ Extension ID를 인수로 전달해주세요."
  echo "   사용법: ./install_mac.sh <EXTENSION_ID>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_PATH="$SCRIPT_DIR/dora_host.py"
MANIFEST_TEMPLATE="$SCRIPT_DIR/com.abc.dora.json"

NM_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_DST="$NM_DIR/com.abc.dora.json"

# Python3 확인
if ! command -v python3 &>/dev/null; then
  echo "❌ python3가 설치되어 있지 않습니다. https://python.org 에서 설치해주세요."
  exit 1
fi

# dora_host.py 실행 권한 부여
chmod +x "$HOST_PATH"

# NativeMessagingHosts 디렉토리 생성
mkdir -p "$NM_DIR"

# 매니페스트 생성 (경로와 Extension ID 치환)
sed \
  -e "s|__DORA_HOST_PATH__|$HOST_PATH|g" \
  -e "s|__EXTENSION_ID__|$EXTENSION_ID|g" \
  "$MANIFEST_TEMPLATE" > "$MANIFEST_DST"

echo "✅ 설치 완료!"
echo "   매니페스트: $MANIFEST_DST"
echo "   호스트 경로: $HOST_PATH"
echo ""
echo "Chrome을 완전히 재시작한 뒤 DORA 확장을 사용하세요."
