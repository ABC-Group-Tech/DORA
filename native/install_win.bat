@echo off
:: DORA Native Messaging Host 설치 스크립트 (Windows)
::
:: 사용법:
::   1. Chrome 확장 프로그램을 먼저 로드한 뒤 Extension ID를 확인한다.
::      (chrome://extensions 에서 "DORA" 카드의 ID 복사)
::   2. 관리자 권한으로 실행한다:
::      install_win.bat <EXTENSION_ID>

setlocal enabledelayedexpansion

set EXTENSION_ID=%1

if "%EXTENSION_ID%"=="" (
    echo [오류] Extension ID를 인수로 전달해주세요.
    echo 사용법: install_win.bat ^<EXTENSION_ID^>
    exit /b 1
)

:: python3 확인
where python >nul 2>&1
if errorlevel 1 (
    echo [오류] Python이 설치되어 있지 않습니다. https://python.org 에서 설치해주세요.
    exit /b 1
)

set SCRIPT_DIR=%~dp0
set HOST_PATH=%SCRIPT_DIR%dora_host.py

:: 매니페스트 파일 생성
set MANIFEST_PATH=%SCRIPT_DIR%com.abc.dora.win.json
(
    echo {
    echo   "name": "com.abc.dora",
    echo   "description": "DORA - 파일 이동 헬퍼",
    echo   "path": "%HOST_PATH:\=\\%",
    echo   "type": "stdio",
    echo   "allowed_origins": [
    echo     "chrome-extension://%EXTENSION_ID%/"
    echo   ]
    echo }
) > "%MANIFEST_PATH%"

:: 레지스트리에 등록
set REG_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.abc.dora
reg add "%REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul

if errorlevel 1 (
    echo [오류] 레지스트리 등록에 실패했습니다. 관리자 권한으로 다시 실행해주세요.
    exit /b 1
)

echo [완료] 설치가 완료되었습니다!
echo   매니페스트: %MANIFEST_PATH%
echo   호스트 경로: %HOST_PATH%
echo.
echo Chrome을 완전히 재시작한 뒤 DORA 확장을 사용하세요.
