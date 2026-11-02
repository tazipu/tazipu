@echo off
setlocal
cd /d "%~dp0"
title 好记帐 手机版 PWA 服务

set "NODE="
where node >nul 2>nul && set "NODE=node"
if not defined NODE if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"

if not defined NODE (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 并加入系统 PATH。
  echo 下载地址: https://nodejs.org
  echo.
  pause
  exit /b 1
)

"%NODE%" server.js
pause