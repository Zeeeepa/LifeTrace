//! Python runtime helpers for backend bootstrap

use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Deserialize)]
struct PythonInfo {
    version: String,
    executable: String,
}

fn get_venv_python_path(venv_dir: &Path) -> PathBuf {
    if cfg!(windows) {
        return venv_dir.join("Scripts").join("python.exe");
    }
    venv_dir.join("bin").join("python3")
}

fn get_venv_uv_path(venv_dir: &Path) -> PathBuf {
    if cfg!(windows) {
        return venv_dir.join("Scripts").join("uv.exe");
    }
    venv_dir.join("bin").join("uv")
}

fn is_mainland_china() -> bool {
    if let Ok(value) = std::env::var("FREETODO_REGION") {
        let normalized = value.to_lowercase();
        if normalized == "cn" {
            return true;
        }
        if normalized == "global" || normalized == "intl" {
            return false;
        }
    }
    if let Ok(lang) = std::env::var("LANG") {
        if lang.to_lowercase().starts_with("zh_cn") {
            return true;
        }
    }
    false
}

fn build_uv_env() -> Vec<(String, String)> {
    if is_mainland_china() {
        vec![
            (
                "UV_INDEX_URL".to_string(),
                "https://pypi.tuna.tsinghua.edu.cn/simple".to_string(),
            ),
            (
                "UV_EXTRA_INDEX_URL".to_string(),
                "https://pypi.org/simple".to_string(),
            ),
            (
                "PIP_INDEX_URL".to_string(),
                "https://pypi.tuna.tsinghua.edu.cn/simple".to_string(),
            ),
            (
                "PIP_EXTRA_INDEX_URL".to_string(),
                "https://pypi.org/simple".to_string(),
            ),
        ]
    } else {
        vec![
            (
                "UV_INDEX_URL".to_string(),
                "https://pypi.org/simple".to_string(),
            ),
            (
                "PIP_INDEX_URL".to_string(),
                "https://pypi.org/simple".to_string(),
            ),
        ]
    }
}

fn run_command(command: &str, args: &[&str], envs: &[(&str, &str)]) -> Result<String, String> {
    let mut cmd = Command::new(command);
    cmd.args(args);
    for (key, value) in envs {
        cmd.env(key, value);
    }
    let output = cmd.output().map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn get_python_info(command: &str, args: &[&str]) -> Option<PythonInfo> {
    let mut full_args = args.to_vec();
    full_args.extend_from_slice(&[
        "-c",
        "import json, sys; print(json.dumps({'version': f'{sys.version_info[0]}.{sys.version_info[1]}', 'executable': sys.executable}))",
    ]);
    let output = run_command(command, &full_args, &[]).ok()?;
    let line = output.lines().next()?.trim();
    serde_json::from_str(line).ok()
}

pub fn find_python312() -> Option<PathBuf> {
    let mut candidates: Vec<(&str, Vec<&str>)> = Vec::new();
    if cfg!(windows) {
        candidates.push(("py", vec!["-3.12"]));
        candidates.push(("python3.12", vec![]));
        candidates.push(("python", vec![]));
    } else {
        candidates.push(("python3.12", vec![]));
        candidates.push(("python3", vec![]));
        candidates.push(("python", vec![]));
    }

    for (command, args) in candidates {
        if let Some(info) = get_python_info(command, &args) {
            if info.version == "3.12" && !info.executable.is_empty() {
                return Some(PathBuf::from(info.executable));
            }
        }
    }
    None
}

pub fn ensure_venv(python_path: &Path, venv_dir: &Path) -> Result<PathBuf, String> {
    let venv_python = get_venv_python_path(venv_dir);
    if venv_python.exists() {
        return Ok(venv_python);
    }
    std::fs::create_dir_all(venv_dir).map_err(|e| format!("Failed to create venv dir: {}", e))?;
    run_command(
        python_path.to_str().ok_or("Invalid python path")?,
        &["-m", "venv", venv_dir.to_str().ok_or("Invalid venv path")?],
        &[],
    )?;
    if venv_python.exists() {
        Ok(venv_python)
    } else {
        Err("Failed to create virtual environment".to_string())
    }
}

pub fn ensure_uv(venv_python: &Path, venv_dir: &Path) -> Result<PathBuf, String> {
    let uv_path = get_venv_uv_path(venv_dir);
    if uv_path.exists() {
        return Ok(uv_path);
    }
    run_command(
        venv_python.to_str().ok_or("Invalid venv python path")?,
        &["-m", "pip", "install", "--upgrade", "uv"],
        &[],
    )?;
    if uv_path.exists() {
        Ok(uv_path)
    } else {
        Err("Failed to install uv in virtual environment".to_string())
    }
}

pub fn install_requirements(
    uv_path: &Path,
    venv_python: &Path,
    requirements_path: &Path,
) -> Result<(), String> {
    let env_pairs = build_uv_env();
    let env_refs: Vec<(&str, &str)> = env_pairs
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    run_command(
        uv_path.to_str().ok_or("Invalid uv path")?,
        &[
            "pip",
            "install",
            "-r",
            requirements_path
                .to_str()
                .ok_or("Invalid requirements path")?,
            "--python",
            venv_python.to_str().ok_or("Invalid venv python path")?,
        ],
        &env_refs,
    )?;
    Ok(())
}
