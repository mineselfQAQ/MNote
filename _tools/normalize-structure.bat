@echo off
setlocal
cd /d "%~dp0.."
echo This will reorganize MNote source files.
echo Press Ctrl+C to cancel, or any key to continue.
pause >nul
node "_tools\scripts\mnote-migrate-structure.js"
pause
