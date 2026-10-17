@echo off
title JARVIS LISTENER - [JARVIS-VOICE-ASSISTANT]
set TARGET_REPO_PATH=%~dp0
call python.bat jarvis_listener.py --project "%~dp0"
