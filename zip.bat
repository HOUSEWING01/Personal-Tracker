@echo off
setlocal
cd /d "%~dp0"

set OUT=business-admin-upload.zip
if exist "%OUT%" del "%OUT%"

echo Creating %OUT% (without node_modules, dist, .env, .git, other zips)...
tar -a -c -f "%OUT%" ^
  --exclude=node_modules ^
  --exclude=dist ^
  --exclude=.git ^
  --exclude=.env ^
  --exclude=*.zip ^
  *

if errorlevel 1 (
  echo.
  echo Zip failed. Make sure you are on Windows 10 or 11 and run this from the Karthick folder.
  pause
  exit /b 1
)

echo.
echo Done: %CD%\%OUT%
dir "%OUT%" | find "%OUT%"
echo Upload this file to Claude. It should be a few hundred KB, not hundreds of MB.
pause