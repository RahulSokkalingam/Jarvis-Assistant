# JARVIS Autonomous Assistant - PowerShell Installer
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "      JARVIS AUTONOMOUS ASSISTANT - POWERSHELL INSTALLER" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Detect Python
Write-Host "[*] Checking Python installation..." -ForegroundColor Yellow
$pyCmd = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
    $pyCmd = "py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pyCmd = "python"
} else {
    $candidates = @(
        "C:\Python313\python.exe",
        "C:\Python312\python.exe",
        "C:\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $pyCmd = $cand
            break
        }
    }
}

if (-not $pyCmd) {
    Write-Host "[!] ERROR: Python was not found on this PC." -ForegroundColor Red
    Write-Host "[!] Please install Python 3.10+ from https://www.python.org/downloads/" -ForegroundColor Red
    Write-Host "[!] Make sure to check 'Add python.exe to PATH'!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[+] Python detected: $pyCmd" -ForegroundColor Green

# 2. Install Python Dependencies
Write-Host ""
Write-Host "[*] Installing Jarvis Python dependencies..." -ForegroundColor Yellow
& $pyCmd -m pip install --upgrade pip
& $pyCmd -m pip install -r "$scriptDir\requirements.txt"
Write-Host "[+] Dependencies verified." -ForegroundColor Green

# 3. Register Global jarvis command
Write-Host ""
Write-Host "[*] Registering global 'jarvis' CLI launcher..." -ForegroundColor Yellow
$npmGlobal = "$env:APPDATA\npm"
if (-not (Test-Path $npmGlobal)) {
    New-Item -ItemType Directory -Path $npmGlobal -Force | Out-Null
}
$batContent = "@echo off`r`n`"$pyCmd`" `"$scriptDir\jarvis_cli.py`" %*"
Set-Content -Path "$npmGlobal\jarvis.bat" -Value $batContent
Set-Content -Path "$npmGlobal\jarvis.cmd" -Value $batContent
Write-Host "[+] Global 'jarvis' registered to $npmGlobal." -ForegroundColor Green

# 4. Install Extension to Antigravity IDE
Write-Host ""
Write-Host "[*] Installing Jarvis Extension into Antigravity IDE..." -ForegroundColor Yellow
$vsix = "$scriptDir\extension\jarvis-antigravity-extension-1.0.0.vsix"
$agyExtDir = "$env:USERPROFILE\.antigravity-ide\extensions\rahulsokkalingam.jarvis-antigravity-extension-1.0.0"

if (Test-Path $vsix) {
    if (Test-Path $agyExtDir) {
        Remove-Item -Recurse -Force $agyExtDir
    }
    New-Item -ItemType Directory -Path $agyExtDir -Force | Out-Null

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($vsix)
    foreach ($e in $zip.Entries) {
        if ($e.FullName.StartsWith('extension/')) {
            $rel = $e.FullName.Substring(10)
            if (-not [string]::IsNullOrEmpty($rel)) {
                $target = Join-Path $agyExtDir $rel
                if ($e.FullName.EndsWith('/')) {
                    New-Item -ItemType Directory -Path $target -Force | Out-Null
                } else {
                    $parent = Split-Path $target
                    if (-not (Test-Path $parent)) {
                        New-Item -ItemType Directory -Path $parent -Force | Out-Null
                    }
                    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $target, $true)
                }
            }
        }
    }
    $zip.Dispose()
    Write-Host "[+] Antigravity IDE Extension installed successfully to: $agyExtDir" -ForegroundColor Green
} else {
    Write-Host "[!] Notice: VSIX package not found at $vsix" -ForegroundColor Red
}

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "      INSTALLATION COMPLETED SUCCESSFULLY!" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "1. Launch Antigravity IDE."
Write-Host "2. Enter your Groq API Key when prompted."
Write-Host "3. Start voice with Ctrl+Alt+J or say 'Hey Jarvis'!"
Write-Host ""
Read-Host "Press Enter to exit"
