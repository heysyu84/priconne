@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
py -3 -c "import sys; sys.exit(sys.version_info < (3, 12))" >nul 2>nul
if errorlevel 1 (
  echo Python 3.12 이상이 필요합니다. https://www.python.org/downloads/windows/
  echo 설치 시 Python Launcher를 함께 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" py -3 -m venv .venv
if not exist ".venv\Scripts\python.exe" (
  echo Python 환경을 만들지 못했습니다.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo 설치 실패. 위 오류를 확인하세요.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" probe.py check
echo 설치 완료. 다음은 2-start.cmd 입니다.
pause
