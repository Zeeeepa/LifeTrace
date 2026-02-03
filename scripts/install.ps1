param(
    [string]$Dir = $env:LIFETRACE_DIR,
    [string]$Repo = $env:LIFETRACE_REPO,
    [Alias("r", "ref")]
    [string]$Ref = $env:LIFETRACE_REF,
    [Alias("m", "mode")]
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

if (-not $dirSet) {
    $repoName = [IO.Path]::GetFileNameWithoutExtension($Repo)
    $Dir = $repoName
}

if ($Mode -eq "island") {
    $Mode = "tauri"
    $Variant = "island"
    $variantSet = $true
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

if ($Mode -eq "web" -and -not $frontendSet) {
    $Frontend = "dev"
}

if ($Frontend -eq "dev" -and $Backend -eq "pyinstaller") {
    throw "backend=pyinstaller is only supported with frontend=build."
}

function Require-Command {
    param(
        [string]$Name,
        [string]$Hint = ""
    )
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        if ($Hint) {
            throw "Missing required command: $Name. $Hint"
        }
        throw "Missing required command: $Name."
    }
}

$pythonCmd = $env:PYTHON_BIN
if (-not $pythonCmd) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonCmd = "python"
    } elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
        $pythonCmd = "python3"
    } else {
        throw "Python 3.12+ not found. Install Python and retry."
    }
}

Require-Command git "Install Git and retry."
Require-Command node "Install Node.js 20+ and retry."

if ($Mode -eq "tauri") {
    Require-Command cargo "Install Rust (rustup) and retry."
}

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "Installing uv..."
    irm https://astral.sh/uv/install.ps1 | iex
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
        corepack enable
        corepack prepare pnpm@latest --activate
    } else {
        throw "pnpm not found and corepack is unavailable. Install Node.js 20+ and retry."
    }
}

if (Test-Path $Dir) {
    if (-not (Test-Path (Join-Path $Dir ".git"))) {
        throw "Target path '$Dir' exists and is not a git repo. Set LIFETRACE_DIR to a new folder."
    }
} else {
    git clone --depth 1 --branch "$Ref" "$Repo" "$Dir"
}

Set-Location $Dir
$gitStatus = git status --porcelain
if ($gitStatus) {
    throw "Repository has local changes. Commit or stash and retry."
}

git fetch --depth 1 "$Repo" "$Ref"
git checkout -q -B "$Ref" FETCH_HEAD
uv sync

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
        pnpm install
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
    pnpm install

    if ($Frontend -eq "build") {
        pnpm "build:tauri:$Variant:$Backend:full"
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
    pnpm install

    if ($Frontend -eq "build") {
        pnpm "build:electron:$Variant:$Backend:full"
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
