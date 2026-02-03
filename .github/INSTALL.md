# One-Click Install (Full Options)

This document contains the full one-click install options referenced in the main README.

## Requirements
- Python 3.12+
- Node.js 20+
- Git
- Rust (only required for Tauri builds)

## Basic usage

macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash
```

Windows (PowerShell):

```powershell
iwr -useb https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.ps1 | iex
```

## Defaults

`mode=tauri`, `variant=web`, `frontend=build`, `backend=script`.

## Environment variables

- `LIFETRACE_DIR`: install directory (defaults to repo name)
- `LIFETRACE_REPO`: repo URL (defaults to `https://github.com/FreeU-group/FreeTodo.git`)
- `LIFETRACE_REF`: branch or tag (defaults to `main`, use `dev` for unstable builds)
- `LIFETRACE_MODE`: `web`, `tauri`, `electron`, or `island`
- `LIFETRACE_VARIANT`: `web` or `island`
- `LIFETRACE_FRONTEND`: `build` or `dev` (web defaults to `dev`)
- `LIFETRACE_BACKEND`: `script` or `pyinstaller`
- `LIFETRACE_RUN`: `1` (default) to run after install, `0` to only install

## Examples

```bash
# Web dev
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --mode web --frontend dev

# Tauri dev (starts backend + frontend dev server, then tauri dev)
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --mode tauri --frontend dev

# Electron island dev
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --mode electron --variant island --frontend dev

# Tauri build with PyInstaller backend
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --mode tauri --frontend build --backend pyinstaller

# Switch ref
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --ref dev
```
