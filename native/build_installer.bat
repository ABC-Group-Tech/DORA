@echo off
:: DORA 설치 앱 빌드 스크립트 (Windows)
:: 실행하면 dist\DORA_설치.exe 가 생성됩니다.
::
:: 사용법: build_installer.bat

setlocal

set APP_NAME=DORA_설치
set SCRIPT_DIR=%~dp0

echo [1/3] PyInstaller 확인 중...
python -m pyinstaller --version >nul 2>&1
if errorlevel 1 (
    echo PyInstaller가 없습니다. 설치합니다...
    pip install pyinstaller
)

echo [2/3] 앱 빌드 시작...
cd /d "%SCRIPT_DIR%"

python -m pyinstaller ^
  --noconfirm ^
  --clean ^
  --windowed ^
  --onefile ^
  --name "%APP_NAME%" ^
  --add-data "dora_host.py;." ^
  installer_gui.py

echo.
echo [3/3] 빌드 완료!
echo    위치: %SCRIPT_DIR%dist\%APP_NAME%.exe
echo.
echo 배포 방법:
echo   dist\%APP_NAME%.exe 를 사용자에게 전달하세요.
echo   더블클릭하면 설치 화면이 바로 열립니다.
