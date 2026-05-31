@echo off
setlocal
cd /d "%~dp0.."
node "_tools\scripts\mnote-export-html.js"
pause
