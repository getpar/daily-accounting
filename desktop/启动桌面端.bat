@echo off
chcp 65001 >nul
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
echo 🚀 正在启动每日小记...
call npm run dev
pause
