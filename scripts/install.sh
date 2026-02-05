#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${LIFETRACE_REPO:-https://github.com/FreeU-group/FreeTodo.git}"
REF="${LIFETRACE_REF:-main}"
REPO_NAME="${REPO_URL##*/}"
REPO_NAME="${REPO_NAME%.git}"
TARGET_DIR="${LIFETRACE_DIR:-$REPO_NAME}"
MODE="${LIFETRACE_MODE:-tauri}"
VARIANT="${LIFETRACE_VARIANT:-web}"
FRONTEND_ACTION="${LIFETRACE_FRONTEND:-build}"
BACKEND_RUNTIME="${LIFETRACE_BACKEND:-script}"
RUN_AFTER_INSTALL="${LIFETRACE_RUN:-1}"

DIR_SET=0
if [ -n "${LIFETRACE_DIR:-}" ]; then
  DIR_SET=1
fi
FRONTEND_SET=0
if [ -n "${LIFETRACE_FRONTEND:-}" ]; then
  FRONTEND_SET=1
fi
VARIANT_SET=0
if [ -n "${LIFETRACE_VARIANT:-}" ]; then
  VARIANT_SET=1
fi

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Options:
  --ref, -r       Git branch or tag to clone
  --mode, -m      web | tauri | electron | island
  --variant       web | island
  --frontend      build | dev
  --backend       script | pyinstaller
  --repo          Git repo URL
  --dir           Target directory
  --run           1 to run after install, 0 to only install
  --help, -h      Show this help message

Env vars:
  LIFETRACE_REPO, LIFETRACE_REF, LIFETRACE_DIR
  LIFETRACE_MODE, LIFETRACE_VARIANT, LIFETRACE_FRONTEND, LIFETRACE_BACKEND, LIFETRACE_RUN

Defaults:
  mode=tauri, variant=web, frontend=build, backend=script, ref=main
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
    --mode|-m)
      if [ $# -lt 2 ]; then
        echo "Missing value for --mode." >&2
        exit 1
      fi
      MODE="$2"
      shift 2
      ;;
    --variant)
      if [ $# -lt 2 ]; then
        echo "Missing value for --variant." >&2
        exit 1
      fi
      VARIANT="$2"
      VARIANT_SET=1
      shift 2
      ;;
    --frontend)
      if [ $# -lt 2 ]; then
        echo "Missing value for --frontend." >&2
        exit 1
      fi
      FRONTEND_ACTION="$2"
      FRONTEND_SET=1
      shift 2
      ;;
    --backend)
      if [ $# -lt 2 ]; then
        echo "Missing value for --backend." >&2
        exit 1
      fi
      BACKEND_RUNTIME="$2"
      shift 2
      ;;
    --repo)
      if [ $# -lt 2 ]; then
        echo "Missing value for --repo." >&2
        exit 1
      fi
      REPO_URL="$2"
      REPO_NAME="${REPO_URL##*/}"
      REPO_NAME="${REPO_NAME%.git}"
      if [ "$DIR_SET" -eq 0 ]; then
        TARGET_DIR="$REPO_NAME"
      fi
      shift 2
      ;;
    --dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --dir." >&2
        exit 1
      fi
      TARGET_DIR="$2"
      DIR_SET=1
      shift 2
      ;;
    --run)
      if [ $# -lt 2 ]; then
        echo "Missing value for --run." >&2
        exit 1
      fi
      RUN_AFTER_INSTALL="$2"
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

if [ "$MODE" = "island" ]; then
  MODE="tauri"
  VARIANT="island"
  VARIANT_SET=1
fi

if [ "$MODE" = "web" ] && [ "$VARIANT" != "web" ]; then
  echo "Variant '$VARIANT' is not supported in web mode." >&2
  exit 1
fi

case "$MODE" in
  web|tauri|electron) ;;
  *)
    echo "Invalid mode: $MODE" >&2
    exit 1
    ;;
 esac

case "$VARIANT" in
  web|island) ;;
  *)
    echo "Invalid variant: $VARIANT" >&2
    exit 1
    ;;
esac

case "$FRONTEND_ACTION" in
  build|dev) ;;
  *)
    echo "Invalid frontend action: $FRONTEND_ACTION" >&2
    exit 1
    ;;
esac

case "$BACKEND_RUNTIME" in
  script|pyinstaller) ;;
  *)
    echo "Invalid backend runtime: $BACKEND_RUNTIME" >&2
    exit 1
    ;;
esac

if [ "$MODE" = "web" ] && [ "$FRONTEND_SET" -eq 0 ]; then
  FRONTEND_ACTION="dev"
fi

if [ "$FRONTEND_ACTION" = "dev" ] && [ "$BACKEND_RUNTIME" = "pyinstaller" ]; then
  echo "backend=pyinstaller is only supported with frontend=build." >&2
  exit 1
fi

MISSING_DEPS=()
MISSING_HINTS=()

add_missing() {
  MISSING_DEPS+=("$1")
  MISSING_HINTS+=("$2")
}

report_missing() {
  if [ "${#MISSING_DEPS[@]}" -eq 0 ]; then
    return 0
  fi

  echo "Missing required dependencies:" >&2
  for i in "${!MISSING_DEPS[@]}"; do
    echo "- ${MISSING_DEPS[$i]}: ${MISSING_HINTS[$i]}" >&2
  done
  echo "Install the missing dependencies and retry." >&2
  exit 1
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
    add_missing "python" "Python 3.12+ not found. Install Python and retry."
  fi
elif ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  add_missing "python" "Python 3.12+ not found. Install Python and retry."
fi

if ! command -v git >/dev/null 2>&1; then
  add_missing "git" "Install Git and retry."
fi
if ! command -v node >/dev/null 2>&1; then
  add_missing "node" "Install Node.js 20+ and retry."
fi

if [ "$MODE" = "tauri" ]; then
  if ! command -v cargo >/dev/null 2>&1; then
    add_missing "cargo" "Install Rust (rustup) and retry, or set LIFETRACE_MODE=web."
  fi
fi

NEED_PNPM_INSTALL=0
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    NEED_PNPM_INSTALL=1
  else
    add_missing "pnpm" "pnpm not found and corepack is unavailable. Install Node.js 20+ and retry."
  fi
fi

if ! command -v uv >/dev/null 2>&1; then
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    add_missing "curl/wget" "curl or wget is required to download uv."
  fi
fi

report_missing

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv..."
  download "https://astral.sh/uv/install.sh" | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

if [ "$NEED_PNPM_INSTALL" -eq 1 ]; then
  corepack enable
  corepack prepare pnpm@latest --activate
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
if [ -n "$(git status --porcelain)" ]; then
  echo "Repository has local changes. Commit or stash and retry." >&2
  exit 1
fi
git fetch --depth 1 "$REPO_URL" "$REF"
git checkout -q -B "$REF" FETCH_HEAD
uv sync

if [ "$RUN_AFTER_INSTALL" != "1" ]; then
  echo "Install complete."
  exit 0
fi

case "$MODE" in
  web)
    echo "Starting backend..."
    uv run "$PYTHON_BIN" -m lifetrace.server &
    BACKEND_PID=$!
    cleanup() {
      if kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
        kill "$BACKEND_PID" >/dev/null 2>&1 || true
      fi
    }
    trap cleanup EXIT

    cd free-todo-frontend
    pnpm install

    if [ "$FRONTEND_ACTION" = "build" ]; then
      echo "Building frontend..."
      pnpm build
      echo "Starting frontend (production)..."
      pnpm start
    else
      echo "Starting frontend (dev)..."
      WINDOW_MODE="$VARIANT" pnpm dev
    fi
    ;;
  tauri)
    cd free-todo-frontend
    pnpm install

    if [ "$FRONTEND_ACTION" = "build" ]; then
      echo "Building Tauri app ($VARIANT, $BACKEND_RUNTIME)..."
      pnpm "build:tauri:${VARIANT}:${BACKEND_RUNTIME}:full"
      echo "Build complete."
    else
      echo "Starting backend..."
      uv run "$PYTHON_BIN" -m lifetrace.server &
      BACKEND_PID=$!
      cleanup() {
        if [ -n "${FRONTEND_PID:-}" ] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
          kill "$FRONTEND_PID" >/dev/null 2>&1 || true
        fi
        if kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
          kill "$BACKEND_PID" >/dev/null 2>&1 || true
        fi
      }
      trap cleanup EXIT

      echo "Starting frontend dev server..."
      WINDOW_MODE="$VARIANT" pnpm dev &
      FRONTEND_PID=$!
      echo "Starting Tauri app..."
      pnpm tauri:dev
    fi
    ;;
  electron)
    cd free-todo-frontend
    pnpm install

    if [ "$FRONTEND_ACTION" = "build" ]; then
      echo "Building Electron app ($VARIANT, $BACKEND_RUNTIME)..."
      pnpm "build:electron:${VARIANT}:${BACKEND_RUNTIME}:full"
      echo "Build complete."
    else
      if [ "$VARIANT" = "island" ]; then
        pnpm electron:dev:island
      else
        pnpm electron:dev
      fi
    fi
    ;;
esac
