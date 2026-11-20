@echo off
rem Chay web FREE.A o local: http://localhost:3000  (quan tri: /admin)
set "PATH=D:\Software\tools\node;%PATH%"
cd /d "%~dp0"
if not exist node_modules call npm install
node server\server.js
