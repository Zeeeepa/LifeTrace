param(
    [string]$Dir = $env:LIFETRACE_DIR,
    [string]$Repo = $env:LIFETRACE_REPO,
    [Alias("r", "ref")]
    [string]$Ref = $env:LIFETRACE_REF
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $Repo) {
    $Repo = "https://github.com/FreeU-group/FreeTodo.git"
}
if (-not $Ref) {
    $Ref = "main"
}
$repoName = [IO.Path]::GetFileNameWithoutExtension($Repo)
if (-not $Dir) {
    $Dir = $repoName
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
git fetch --depth 1 origin $Ref
git checkout -q $Ref
git pull --ff-only origin $Ref
uv sync

$uvPath = (Get-Command uv).Source
$backendJob = Start-Job -ScriptBlock {
    param($RepoDir, $UvPath, $PythonCmd)
    Set-Location $RepoDir
    & $UvPath run $PythonCmd -m lifetrace.server
} -ArgumentList (Get-Location).Path, $uvPath, $pythonCmd

try {
    Set-Location (Join-Path (Get-Location).Path "free-todo-frontend")
    pnpm install
    pnpm dev
} finally {
    if ($backendJob -and $backendJob.State -eq "Running") {
        Stop-Job $backendJob | Out-Null
    }
    if ($backendJob) {
        Remove-Job $backendJob -Force | Out-Null
    }
}
