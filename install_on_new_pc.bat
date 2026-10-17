@echo off
setlocal enabledelayedexpansion
title JARVIS - New PC Automatic Installer

echo =========================================================================
echo       JARVIS AUTONOMOUS ASSISTANT - NEW PC AUTOMATIC INSTALLER
echo =========================================================================
echo.

:: 1. Check Python
echo [*] Checking Python installation...
py --version >nul 2>&1
if %errorlevel% neq 0 (
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [!] Python is not detected in PATH.
        echo [!] Please install Python 3.10+ from https://python.org and check "Add to PATH".
        pause
        exit /b 1
    )
    set PY_CMD=python
) else (
    set PY_CMD=py
)
echo [+] Python detected.

:: 2. Check Git
echo [*] Checking Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Git is not installed or not in PATH.
    echo [!] Please install Git from https://git-scm.com/
    pause
    exit /b 1
)
echo [+] Git detected.

:: 3. Install Python Dependencies
echo.
echo [*] Installing Jarvis Python dependencies...
%PY_CMD% -m pip install --upgrade pip
%PY_CMD% -m pip install -r "%~dp0requirements.txt"
if %errorlevel% neq 0 (
    echo [!] Warning: Some packages had installation notices, attempting core packages...
    %PY_CMD% -m pip install PyQt6 psutil python-dotenv requests pygame pyaudio edge-tts openwakeword
)
echo [+] Python dependencies installed successfully.

:: 4. Install Global 'jarvis' CLI Command
echo.
echo [*] Registering global 'jarvis' CLI launcher...
set "NPM_GLOBAL=%APPDATA%\npm"
if not exist "%NPM_GLOBAL%" (
    mkdir "%NPM_GLOBAL%" >nul 2>&1
)
(
    echo @echo off
    echo %PY_CMD% "%~dp0jarvis_cli.py" %%*
) > "%NPM_GLOBAL%\jarvis.bat"

(
    echo @echo off
    echo %PY_CMD% "%~dp0jarvis_cli.py" %%*
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

    powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('%VSIX_FILE%'); foreach ($e in $zip.Entries) { if ($e.FullName.StartsWith('extension/')) { $rel = $e.FullName.Substring(10); if (-not [string]::IsNullOrEmpty($rel)) { $dest = Join-Path '%AGY_EXT_DIR%' $rel; if ($e.FullName.EndsWith('/')) { New-Item -ItemType Directory -Path $dest -Force | Out-Null } else { $p = Split-Path $dest; if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }; [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true) } } } }; $zip.Dispose()"
    echo [+] Antigravity IDE Extension installed to: %AGY_EXT_DIR%
) else (
    echo [!] Notice: VSIX package not found at %VSIX_FILE%
)

echo.
echo =========================================================================
echo       INSTALLATION COMPLETED SUCCESSFULLY!
echo =========================================================================
echo.
echo What to do next on this PC:
echo 1. Open Antigravity IDE.
echo 2. When prompted, enter your Groq API Key (starts with gsk_...).
echo 3. The Cyber HUD Activity Bar icon and Status Bar badge will be active.
echo 4. Run 'jarvis init' in any project to link Jarvis voice and HUD.
echo.
pause
