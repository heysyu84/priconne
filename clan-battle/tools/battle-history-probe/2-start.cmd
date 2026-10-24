@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist ".venv\Scripts\python.exe" (
  echo 먼저 1-install.cmd를 실행하세요.
  pause
  exit /b 1
)
echo 1. 연결 주소 확인 - 처음에는 이 항목을 선택하세요. 인증서 설치 불필요.
echo 2. 배틀이력 추출 - 게임 서버 주소와 인증서 설정을 마친 경우.
choice /c 12 /n /m "선택 (1 또는 2): "
if errorlevel 2 (
  ".venv\Scripts\python.exe" probe.py run
) else (
  ".venv\Scripts\python.exe" probe.py discover
)
echo 종료했습니다. 앱플레이어의 프록시를 해제하세요.
pause
