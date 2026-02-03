#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${LIFETRACE_REPO:-https://github.com/FreeU-group/FreeTodo.git}"
REF="${LIFETRACE_REF:-main}"
REPO_NAME="${REPO_URL##*/}"
REPO_NAME="${REPO_NAME%.git}"
TARGET_DIR="${LIFETRACE_DIR:-$REPO_NAME}"

usage() {
  cat <<'EOF'
Usage: install_web.sh [--ref <branch_or_tag>]

Options:
  --ref, -r   Git branch or tag to clone (overrides LIFETRACE_REF)
  --help, -h  Show this help message
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --ref|-r)
      if [ $# -lt 2 ]; then
        echo "Missing value for --ref." >&2
        exit 1
      fi
      REF="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd() {
  local name="$1"
  local hint="${2:-}"
  if ! command -v "$name" >/dev/null 2>&1; then
    if [ -n "$hint" ]; then
      echo "Missing required command: $name. $hint" >&2
    else
      echo "Missing required command: $name." >&2
    fi
    exit 1
  fi
}

download() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -LsSf "$url"
    return 0
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -qO- "$url"
    return 0
  fi
  echo "Missing required command: curl or wget." >&2
  exit 1
}

PYTHON_BIN="${PYTHON_BIN:-}"
if [ -z "$PYTHON_BIN" ]; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "Python 3.12+ not found. Please install Python and retry." >&2
    exit 1
  fi
fi

require_cmd git "Install Git and retry."
require_cmd node "Install Node.js 20+ and retry."

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv..."
  download "https://astral.sh/uv/install.sh" | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@latest --activate
  else
    echo "pnpm not found and corepack is unavailable. Install Node.js 20+ and retry." >&2
    exit 1
  fi
fi

if [ -e "$TARGET_DIR" ] && [ ! -d "$TARGET_DIR/.git" ]; then
  echo "Target path '$TARGET_DIR' exists and is not a git repo." >&2
  echo "Set LIFETRACE_DIR to a new folder and retry." >&2
  exit 1
fi

if [ ! -d "$TARGET_DIR/.git" ]; then
  git clone --depth 1 --branch "$REF" "$REPO_URL" "$TARGET_DIR"
fi

cd "$TARGET_DIR"
if ! git diff --quiet; then
  echo "Repository has local changes. Commit or stash and retry." >&2
  exit 1
fi
git fetch --depth 1 "$REPO_URL" "$REF"
git checkout -q -B "$REF" FETCH_HEAD

uv sync

echo "Starting backend..."
uv run "$PYTHON_BIN" -m lifetrace.server &
BACKEND_PID=$!

cleanup() {
  if kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Starting frontend..."
cd free-todo-frontend
pnpm install
pnpm dev
