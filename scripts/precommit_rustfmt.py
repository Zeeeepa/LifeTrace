#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    tauri_dir = repo_root / "free-todo-frontend" / "src-tauri"
    if not tauri_dir.exists():
        print(f"Rust hook skipped: missing {tauri_dir}", file=sys.stderr)
        return 0

    try:
        subprocess.run(
            ["cargo", "fmt", "--all", "--", "--check"],
            cwd=tauri_dir,
            check=True,
        )
    except FileNotFoundError:
        print("cargo not found in PATH. Install Rust and retry.", file=sys.stderr)
        return 127
    except subprocess.CalledProcessError as exc:
        return exc.returncode

    return 0


if __name__ == "__main__":
    raise SystemExit(run())
