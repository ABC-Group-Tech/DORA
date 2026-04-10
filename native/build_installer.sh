#!/bin/bash
# DORA 설치 앱 빌드 스크립트 (macOS)
# 실행하면 dist/DORA_설치.app 이 생성됩니다.
#
# 사용법:
#   chmod +x build_installer.sh && ./build_installer.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="DORA 설치"

echo "📦 PyInstaller 설치 확인 중..."
if ! python3 -m pyinstaller --version &>/dev/null; then
  echo "  PyInstaller가 없습니다. 설치합니다..."
  pip3 install pyinstaller
fi

echo "🔨 앱 빌드 시작..."
cd "$SCRIPT_DIR"

python3 -m pyinstaller \
  --noconfirm \
  --clean \
  --windowed \
  --onedir \
  --name "$APP_NAME" \
  --add-data "dora_host.py:." \
  installer_gui.py

echo ""
echo "✅ 빌드 완료!"
echo "   위치: $SCRIPT_DIR/dist/${APP_NAME}.app"
echo ""
echo "배포 방법:"
echo "  dist/${APP_NAME}.app 을 사용자에게 전달하세요."
echo "  더블클릭하면 설치 화면이 바로 열립니다."
