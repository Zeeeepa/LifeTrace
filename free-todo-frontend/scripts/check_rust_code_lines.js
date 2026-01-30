#!/usr/bin/env node
/**
 * 检查 Rust 文件的有效代码行数（不含空行和注释行）。
 * 超过指定行数上限的文件将被报告，脚本以非零状态码退出。
 *
 * 使用方法：
 *   # 检查整个目录（单独运行）
 *   node check_rust_code_lines.js [--include dirs] [--exclude dirs] [--max lines]
 *
 *   # 检查指定文件（pre-commit 模式）
 *   node check_rust_code_lines.js [options] file1.rs file2.rs ...
 */

const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { dirname, isAbsolute, join, relative, resolve } = require("node:path");

const DEFAULT_INCLUDE = ["src-tauri/src"];
const DEFAULT_EXCLUDE = ["src-tauri/target"];
const DEFAULT_MAX_LINES = 500;

function parseArgs() {
  const args = process.argv.slice(2);
  let includeDirs = DEFAULT_INCLUDE;
  let excludeDirs = DEFAULT_EXCLUDE;
  let maxLines = DEFAULT_MAX_LINES;
  /** @type {string[]} */
  const files = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--include" && args[i + 1]) {
      includeDirs = args[i + 1]
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      i++;
    } else if (arg === "--exclude" && args[i + 1]) {
      excludeDirs = args[i + 1]
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      i++;
    } else if (arg === "--max" && args[i + 1]) {
      maxLines = parseInt(args[i + 1], 10);
      i++;
    } else if (!arg.startsWith("--")) {
      files.push(arg);
    }
  }

  return { includeDirs, excludeDirs, maxLines, files };
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("*/")
  );
}

function countCodeLines(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let codeLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      if (isCommentLine(line)) {
        continue;
      }
      codeLines++;
    }

    return codeLines;
  } catch (error) {
    console.error(`警告：无法读取文件 ${filePath}: ${error}`);
    return 0;
  }
}

function normalizePath(p) {
  return p.replace(/\\/g, "/");
}

function shouldCheckFile(relPath, includeDirs, excludeDirs) {
  const normalizedPath = normalizePath(relPath);

  const inInclude = includeDirs.some((inc) =>
    normalizedPath.startsWith(normalizePath(inc))
  );
  if (!inInclude) {
    return false;
  }

  const inExclude = excludeDirs.some((exc) =>
    normalizedPath.startsWith(normalizePath(exc))
  );
  if (inExclude) {
    return false;
  }

  return true;
}

function* walkDir(dir) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
          continue;
        }
        yield* walkDir(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".rs")) {
          yield fullPath;
        }
      }
    }
  } catch {
    // ignore inaccessible dirs
  }
}

function getFilesToCheck(config, rootDir) {
  /** @type {string[]} */
  const filesToCheck = [];

  if (config.files.length > 0) {
    for (const fileStr of config.files) {
      const filePath = isAbsolute(fileStr) ? fileStr : resolve(fileStr);
      if (!filePath.endsWith(".rs")) {
        continue;
      }
      if (!existsSync(filePath)) {
        continue;
      }

      /** @type {string} */
      let relPath;
      try {
        relPath = relative(rootDir, filePath);
        if (relPath.startsWith("..")) {
          continue;
        }
      } catch {
        continue;
      }

      if (shouldCheckFile(relPath, config.includeDirs, config.excludeDirs)) {
        filesToCheck.push(filePath);
      }
    }
  } else {
    for (const filePath of walkDir(rootDir)) {
      const relPath = relative(rootDir, filePath);
      if (shouldCheckFile(relPath, config.includeDirs, config.excludeDirs)) {
        filesToCheck.push(filePath);
      }
    }
  }

  return filesToCheck;
}

function main() {
  const config = parseArgs();
  const rootDir = dirname(__dirname);
  const filesToCheck = getFilesToCheck(config, rootDir);

  if (filesToCheck.length === 0) {
    if (config.files.length > 0) {
      return 0;
    }
    console.log("未找到需要检查的 Rust 文件");
    return 0;
  }

  /** @type {Array<{ path: string; lines: number }>} */
  const violations = [];

  for (const filePath of filesToCheck) {
    const relPath = relative(rootDir, filePath);
    const codeLines = countCodeLines(filePath);
    if (codeLines > config.maxLines) {
      violations.push({ path: relPath, lines: codeLines });
    }
  }

  if (violations.length > 0) {
    console.log(`❌ 以下文件代码行数超过 ${config.maxLines} 行：`);
    violations.sort((a, b) => a.path.localeCompare(b.path));
    for (const { path, lines } of violations) {
      console.log(`  ${path} -> ${lines} 行`);
    }
    return 1;
  }

  const modeDesc =
    config.files.length > 0 ? `检查了 ${filesToCheck.length} 个文件，` : "";
  console.log(
    `✓ ${modeDesc}所有 Rust 文件代码行数均不超过 ${config.maxLines} 行`
  );
  return 0;
}

process.exit(main());
