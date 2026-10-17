@echo off
title JARVIS HUD - [JARVIS-VOICE-ASSISTANT]
set TARGET_REPO_PATH=%~dp0
call python.bat jarvis_hud.py --project "%~dp0"
