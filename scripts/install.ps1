param(
    [string]$Dir = $env:LIFETRACE_DIR,
    [string]$Repo = $env:LIFETRACE_REPO,
    [Alias("r")]
    [string]$Ref = $env:LIFETRACE_REF,
    [Alias("m")]
    [string]$Mode = $env:LIFETRACE_MODE,
    [string]$Variant = $env:LIFETRACE_VARIANT,
    [string]$Frontend = $env:LIFETRACE_FRONTEND,
    [string]$Backend = $env:LIFETRACE_BACKEND,
    [string]$Run = $env:LIFETRACE_RUN
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$frontendSet = $PSBoundParameters.ContainsKey("Frontend") -or [bool]$env:LIFETRACE_FRONTEND
$variantSet = $PSBoundParameters.ContainsKey("Variant") -or [bool]$env:LIFETRACE_VARIANT
$dirSet = $PSBoundParameters.ContainsKey("Dir") -or [bool]$env:LIFETRACE_DIR
$modeSet = $PSBoundParameters.ContainsKey("Mode") -or [bool]$env:LIFETRACE_MODE
$backendSet = $PSBoundParameters.ContainsKey("Backend") -or [bool]$env:LIFETRACE_BACKEND

if (-not $Repo) {
    $Repo = "https://github.com/FreeU-group/FreeTodo.git"
}
if (-not $Ref) {
    $Ref = "main"
}
if (-not $Mode) {
    $Mode = "tauri"
}
if (-not $Variant) {
    $Variant = "web"
}
if (-not $Frontend) {
    $Frontend = "build"
}
if (-not $Backend) {
    $Backend = "script"
}
if (-not $Run) {
    $Run = "1"
}

function Prompt-Choice {
    param(
        [string]$Label,
        [string[]]$Choices,
        [string]$Default
    )
    Write-Host $Label
    for ($i = 0; $i -lt $Choices.Count; $i++) {
        Write-Host "  $($i + 1)) $($Choices[$i])"
    }
    $input = Read-Host "Select [default: $Default]"
    if ([string]::IsNullOrWhiteSpace($input)) {
        return $Default
    }
    if ($input -match '^\d+$') {
        $index = [int]$input - 1
        if ($index -ge 0 -and $index -lt $Choices.Count) {
            return $Choices[$index]
        }
    } else {
        foreach ($choice in $Choices) {
            if ($choice -eq $input) {
                return $choice
            }
        }
    }
    Write-Host "Invalid choice. Using default: $Default"
    return $Default
}

if (-not $dirSet) {
    $repoName = [IO.Path]::GetFileNameWithoutExtension($Repo)
    $Dir = $repoName
}

if (-not $variantSet) {
    $Variant = Prompt-Choice "Select UI variant:" @("web", "island") "web"
}
if (-not $backendSet) {
    $Backend = Prompt-Choice "Select backend runtime:" @("script", "pyinstaller") "script"
}
if (-not $modeSet) {
    $Mode = Prompt-Choice "Select app mode:" @("tauri", "electron", "web") "tauri"
}

if ($Mode -eq "island") {
    $Mode = "tauri"
    $Variant = "island"
    $variantSet = $true
}

if ($Variant -eq "island" -and $Mode -eq "web") {
    Write-Host "Variant 'island' is not supported in web mode. Switching mode to tauri."
    $Mode = "tauri"
}

if ($Mode -eq "web" -and $Variant -ne "web") {
    throw "Variant '$Variant' is not supported in web mode."
}

$validModes = @("web", "tauri", "electron")
if ($validModes -notcontains $Mode) {
    throw "Invalid mode: $Mode"
}

$validVariants = @("web", "island")
if ($validVariants -notcontains $Variant) {
    throw "Invalid variant: $Variant"
}

$validFrontend = @("build", "dev")
if ($validFrontend -notcontains $Frontend) {
    throw "Invalid frontend action: $Frontend"
}

$validBackend = @("script", "pyinstaller")
if ($validBackend -notcontains $Backend) {
    throw "Invalid backend runtime: $Backend"
}

if ($Backend -eq "pyinstaller" -and -not $frontendSet) {
    $Frontend = "build"
}

if ($Mode -eq "web" -and -not $frontendSet -and $Backend -ne "pyinstaller") {
    $Frontend = "dev"
}

if ($Frontend -eq "dev" -and $Backend -eq "pyinstaller") {
    throw "backend=pyinstaller is only supported with frontend=build."
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

$missingDeps = New-Object System.Collections.Generic.List[object]

function Add-MissingDep {
    param(
        [string]$Name,
        [string]$Hint,
        [string]$WingetId = ""
    )
    $missingDeps.Add([pscustomobject]@{
            Name     = $Name
            Hint     = $Hint
            WingetId = $WingetId
        })
}

function Refresh-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

function Install-MissingDeps {
    if ($missingDeps.Count -eq 0) {
        return
    }

    $wingetDeps = $missingDeps | Where-Object { $_.WingetId }
    if ($wingetDeps -and -not (Test-Command "winget")) {
        Install-Winget | Out-Null
    }
    if ($wingetDeps -and (Test-Command "winget")) {
        foreach ($dep in $wingetDeps) {
            Write-Host "Installing $($dep.Name) with winget..."
            winget install --id $($dep.WingetId) -e --accept-package-agreements --accept-source-agreements
        }
        Refresh-Path
    }
}

function Filter-MissingDeps {
    $remaining = New-Object System.Collections.Generic.List[object]
    foreach ($dep in $missingDeps) {
        if (-not (Test-Command $dep.Name)) {
            $remaining.Add($dep)
        }
    }
    $script:missingDeps = $remaining
}

function Show-MissingDeps {
    if ($missingDeps.Count -eq 0) {
        return
    }

    Write-Host "Missing required dependencies:" -ForegroundColor Red
    foreach ($dep in $missingDeps) {
        Write-Host "- $($dep.Name): $($dep.Hint)"
    }

    $wingetDeps = $missingDeps | Where-Object { $_.WingetId }
    if ($wingetDeps -and (Test-Command "winget")) {
        Write-Host "Install with winget:"
        foreach ($dep in $wingetDeps) {
            Write-Host "  winget install --id $($dep.WingetId) -e --accept-package-agreements --accept-source-agreements"
        }
    } elseif ($wingetDeps) {
        Write-Host "winget not found. Install App Installer from Microsoft Store or from https://aka.ms/getwinget"
    }

    throw "Missing required dependencies. Install them and retry."
}

function Install-Winget {
    if (Test-Command "winget") {
        return $true
    }
    if (-not (Test-Command "Add-AppxPackage")) {
        return $false
    }
    $wingetInstallerUrl = "https://aka.ms/getwinget"
    $installerPath = Join-Path $env:TEMP "winget.msixbundle"
    try {
        Write-Host "winget not found. Attempting to install App Installer..."
        Invoke-WebRequest -Uri $wingetInstallerUrl -OutFile $installerPath
        Add-AppxPackage -Path $installerPath
        Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "Automatic winget install failed."
        return $false
    }
    return (Test-Command "winget")
}

$pythonCmd = $env:PYTHON_BIN
if (-not $pythonCmd) {
    if (Test-Command "python") {
        $pythonCmd = "python"
    } elseif (Test-Command "python3") {
        $pythonCmd = "python3"
    } else {
        Add-MissingDep "python" "Python 3.12+ not found. Install Python and retry." "Python.Python.3.12"
    }
} elseif (-not (Test-Command $pythonCmd)) {
    Add-MissingDep "python" "Python 3.12+ not found. Install Python and retry." "Python.Python.3.12"
}

if (-not (Test-Command "git")) {
    Add-MissingDep "git" "Install Git and retry." "Git.Git"
}
if (-not (Test-Command "node")) {
    Add-MissingDep "node" "Install Node.js 20+ and retry." "OpenJS.NodeJS.LTS"
}

if ($Mode -eq "tauri") {
    if (-not (Test-Command "cargo")) {
        Add-MissingDep "cargo" "Install Rust (rustup) and retry, or set LIFETRACE_MODE=web." "Rustlang.Rustup"
    }
}

Install-MissingDeps
Filter-MissingDeps
Show-MissingDeps

if (-not $pythonCmd -or -not (Test-Command $pythonCmd)) {
    if (Test-Command "python") {
        $pythonCmd = "python"
    } elseif (Test-Command "python3") {
        $pythonCmd = "python3"
    } else {
        throw "Python 3.12+ not found after installation. Reopen your terminal and retry."
    }
}

if (-not (Test-Command "uv")) {
    Write-Host "Installing uv..."
    irm https://astral.sh/uv/install.ps1 | iex
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}

if (-not (Test-Command "pnpm")) {
    if (Test-Command "corepack") {
        corepack enable
        corepack prepare pnpm@latest --activate
    } elseif (Test-Command "npm") {
        npm install -g pnpm
        Refresh-Path
    }
    if (-not (Test-Command "pnpm")) {
        throw "pnpm not found after installation. Reopen your terminal and retry."
    }
}

$repoReady = $false
if (Test-Path $Dir) {
    if (-not (Test-Path (Join-Path $Dir ".git"))) {
        throw "Target path '$Dir' exists and is not a git repo. Set LIFETRACE_DIR to a new folder."
    }
    Set-Location $Dir
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        throw "Repository has local changes. Commit or stash and retry."
    }
    git fetch --depth 1 "$Repo" "$Ref"
    $headSha = git rev-parse HEAD
    $remoteSha = git rev-parse FETCH_HEAD
    if ($headSha -eq $remoteSha) {
        $repoReady = $true
    }
} else {
    git clone --depth 1 --branch "$Ref" "$Repo" "$Dir"
    Set-Location $Dir
}

if (-not $repoReady) {
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        throw "Repository has local changes. Commit or stash and retry."
    }
    git fetch --depth 1 "$Repo" "$Ref"
    git checkout -q -B "$Ref" FETCH_HEAD
    uv sync
} else {
    Write-Host "Repository is up to date. Skipping install steps."
}

if ($Run -ne "1") {
    Write-Host "Install complete."
    exit 0
}

if ($Mode -eq "web") {
    $uvPath = (Get-Command uv).Source
    $backendJob = Start-Job -ScriptBlock {
        param($RepoDir, $UvPath, $PythonCmd)
        Set-Location $RepoDir
        & $UvPath run $PythonCmd -m lifetrace.server
    } -ArgumentList (Get-Location).Path, $uvPath, $pythonCmd

    try {
        Set-Location (Join-Path (Get-Location).Path "free-todo-frontend")
        if (-not $repoReady) {
            pnpm install
        }
        if ($Frontend -eq "build") {
            pnpm build
            pnpm start
        } else {
            $env:WINDOW_MODE = $Variant
            pnpm dev
        }
    } finally {
        if ($backendJob -and $backendJob.State -eq "Running") {
            Stop-Job $backendJob | Out-Null
        }
        if ($backendJob) {
            Remove-Job $backendJob -Force | Out-Null
        }
    }
} elseif ($Mode -eq "tauri") {
    Set-Location (Join-Path (Get-Location).Path "free-todo-frontend")
    if (-not $repoReady) {
        pnpm install
    }

    if ($Frontend -eq "build") {
        pnpm "build:tauri:${Variant}:${Backend}:full"
        Write-Host "Build complete."
    } else {
        $uvPath = (Get-Command uv).Source
        $backendJob = Start-Job -ScriptBlock {
            param($RepoDir, $UvPath, $PythonCmd)
            Set-Location $RepoDir
            & $UvPath run $PythonCmd -m lifetrace.server
        } -ArgumentList (Resolve-Path "..").Path, $uvPath, $pythonCmd

        $frontendJob = Start-Job -ScriptBlock {
            param($FrontendDir, $Variant)
            Set-Location $FrontendDir
            $env:WINDOW_MODE = $Variant
            pnpm dev
        } -ArgumentList (Get-Location).Path, $Variant

        try {
            pnpm tauri:dev
        } finally {
            if ($frontendJob -and $frontendJob.State -eq "Running") {
                Stop-Job $frontendJob | Out-Null
            }
            if ($frontendJob) {
                Remove-Job $frontendJob -Force | Out-Null
            }
            if ($backendJob -and $backendJob.State -eq "Running") {
                Stop-Job $backendJob | Out-Null
            }
            if ($backendJob) {
                Remove-Job $backendJob -Force | Out-Null
            }
        }
    }
} else {
    Set-Location (Join-Path (Get-Location).Path "free-todo-frontend")
    if (-not $repoReady) {
        pnpm install
    }

    if ($Frontend -eq "build") {
        pnpm "build:electron:${Variant}:${Backend}:full"
        Write-Host "Build complete."
    } else {
        if ($Backend -eq "pyinstaller") {
            throw "backend=pyinstaller is only supported with frontend=build."
        }
        if ($Variant -eq "island") {
            pnpm electron:dev:island
        } else {
            pnpm electron:dev
        }
    }
}
