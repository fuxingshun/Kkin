@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-pilot.ps1" %*
