@echo off
cd /d "%~dp0"
echo 启动金融数据服务...
echo.
echo 1. 启动 Flask 服务器中...
start http://localhost:5000
python backend\server.py