@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
for /f "delims=" %%D in ('dir /b /ad /o-n output 2^>nul') do (
  if exist "output\%%D\report.html" (
    start "" "output\%%D\report.html"
    exit /b 0
  )
)
echo 아직 보고서가 없습니다. 2-start.cmd를 먼저 실행하세요.
pause
