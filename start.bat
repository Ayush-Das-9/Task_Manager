@echo off
title Task Manager
cd /d "%~dp0"
start "" http://localhost:5000
python app.py
taskkill /f /im python.exe /fi "WINDOWTITLE eq Task Manager" >nul 2>&1
