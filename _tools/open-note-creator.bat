@echo off
setlocal
cd /d "%~dp0.."

set "PROJECT=_tools\MNoteCreator\MNoteCreator.csproj"
set "PUBLISH_DIR=_tools\MNoteCreator\.publish"
set "APP_EXE=%PUBLISH_DIR%\MNoteCreator.exe"

if not exist "%APP_EXE%" (
  echo Publishing MNoteCreator...
  dotnet publish "%PROJECT%" -c Release -o "%PUBLISH_DIR%"
  if errorlevel 1 (
    echo.
    echo Failed to publish MNoteCreator.
    pause
    exit /b 1
  )
)

start "" "%APP_EXE%"
exit /b 0
