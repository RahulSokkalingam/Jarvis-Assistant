@echo off
setlocal enabledelayedexpansion
title JARVIS - New PC Automatic Installer

cd /d "%~dp0"

echo =========================================================================
echo       JARVIS AUTONOMOUS ASSISTANT - NEW PC AUTOMATIC INSTALLER
echo =========================================================================
echo.

:: 1. Check Python
echo [*] Checking Python installation...
set PY_CMD=
py --version >nul 2>&1
if %errorlevel% equ 0 (
    set PY_CMD=py
) else (
    python --version >nul 2>&1
    if %errorlevel% equ 0 (
        set PY_CMD=python
    ) else (
        if exist "C:\Python313\python.exe" (
            set "PY_CMD=C:\Python313\python.exe"
        ) else if exist "C:\Python312\python.exe" (
            set "PY_CMD=C:\Python312\python.exe"
        ) else if exist "C:\Python311\python.exe" (
            set "PY_CMD=C:\Python311\python.exe"
        ) else if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
            set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
        ) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
            set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        ) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
            set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
        )
    )
)

if "%PY_CMD%"=="" (
    echo.
    echo [!] ERROR: Python was not detected on this PC.
    echo [!] Please download and install Python 3.10+ from: https://www.python.org/downloads/
    echo [!] CRITICAL: Make sure to check the box "Add python.exe to PATH" during installation!
    echo.
    pause
    exit /b 1
)

echo [+] Python detected: %PY_CMD%

:: 2. Check Git (optional for running, but helpful)
echo [*] Checking Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Note: Git not found in PATH, continuing setup...
) else (
    echo [+] Git detected.
)

:: 3. Install Python Dependencies
echo.
echo [*] Installing Jarvis Python dependencies...
"%PY_CMD%" -m pip install --upgrade pip
"%PY_CMD%" -m pip install -r "%~dp0requirements.txt"
if %errorlevel% neq 0 (
    echo [!] Warning: Some wheels failed, attempting core packages...
    "%PY_CMD%" -m pip install PyQt6 psutil python-dotenv requests pygame pyaudio edge-tts openwakeword
)
echo [+] Python dependencies verified.

:: 4. Install Global 'jarvis' CLI Command
echo.
echo [*] Registering global 'jarvis' CLI launcher...
set "NPM_GLOBAL=%APPDATA%\npm"
if not exist "%NPM_GLOBAL%" (
    mkdir "%NPM_GLOBAL%" >nul 2>&1
)
(
    echo @echo off
    echo "%PY_CMD%" "%~dp0jarvis_cli.py" %%*
) > "%NPM_GLOBAL%\jarvis.bat"

(
    echo @echo off
    echo "%PY_CMD%" "%~dp0jarvis_cli.py" %%*
) > "%NPM_GLOBAL%\jarvis.cmd"
echo [+] Global 'jarvis' command registered to %NPM_GLOBAL%.

:: 5. Install Antigravity IDE Extension
echo.
echo [*] Installing Jarvis Extension into Antigravity IDE...
set "VSIX_FILE=%~dp0extension\jarvis-antigravity-extension-1.0.0.vsix"
set "AGY_EXT_DIR=%USERPROFILE%\.antigravity-ide\extensions\rahulsokkalingam.jarvis-antigravity-extension-1.0.0"

if exist "%VSIX_FILE%" (
    if exist "%AGY_EXT_DIR%" rmdir /s /q "%AGY_EXT_DIR%" >nul 2>&1
    mkdir "%AGY_EXT_DIR%" >nul 2>&1

    powershell -NoProfile -ExecutionPolicy Bypass -Command "$vsix = '%VSIX_FILE%'; $dest = '%AGY_EXT_DIR%'; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead($vsix); foreach ($e in $zip.Entries) { if ($e.FullName.StartsWith('extension/')) { $rel = $e.FullName.Substring(10); if (-not [string]::IsNullOrEmpty($rel)) { $target = Join-Path $dest $rel; if ($e.FullName.EndsWith('/')) { New-Item -ItemType Directory -Path $target -Force | Out-Null } else { $p = Split-Path $target; if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }; [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $target, $true) } } } }; $zip.Dispose()"
    echo [+] Antigravity IDE Extension installed successfully to:
    echo     %AGY_EXT_DIR%
) else (
    echo [!] Notice: VSIX package not found at %VSIX_FILE%
)

echo.
echo =========================================================================
echo       INSTALLATION COMPLETED SUCCESSFULLY!
echo =========================================================================
echo.
echo Next Steps:
echo 1. Launch Antigravity IDE.
echo 2. When prompted, enter your Groq API Key (starts with gsk_...).
echo 3. The Cyber HUD Activity Bar icon and Status Bar badge will be active.
echo 4. Say "Hey Jarvis" or press Ctrl+Alt+J to speak, Ctrl+Alt+H for Desktop HUD!
echo.
pause
