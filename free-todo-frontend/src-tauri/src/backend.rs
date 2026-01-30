//! Python Backend Sidecar Management
//!
//! This module handles the lifecycle of the Python backend server,
//! including starting, health checking, and stopping the process.

use crate::backend_paths::{
    get_backend_path, get_backend_script_entry, get_backend_script_root, get_data_dir,
    get_requirements_path, get_runtime_root,
};
use crate::backend_python::{ensure_uv, ensure_venv, find_python312, install_requirements};
use crate::config::{self, timeouts};
use log::{error, info, warn};
use reqwest::Client;
use serde::Deserialize;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::AppHandle;

/// Global backend process reference
static BACKEND_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Current backend port
static BACKEND_PORT: AtomicU16 = AtomicU16::new(8001);

/// Flag indicating if backend is stopping
static IS_STOPPING: AtomicBool = AtomicBool::new(false);

/// Health check response structure
#[derive(Deserialize, Debug)]
struct HealthResponse {
    app: Option<String>,
    server_mode: Option<String>,
}

/// Backend runtime type
#[derive(Debug, Clone, Copy, PartialEq)]
enum BackendRuntime {
    Script,
    PyInstaller,
}

/// Determine backend runtime from env or build-time default
fn get_backend_runtime() -> BackendRuntime {
    if let Ok(value) = std::env::var("FREETODO_BACKEND_RUNTIME") {
        let normalized = value.to_lowercase();
        if normalized == "pyinstaller" {
            return BackendRuntime::PyInstaller;
        }
        if normalized == "script" {
            return BackendRuntime::Script;
        }
    }

    if let Some(value) = option_env!("FREETODO_BACKEND_RUNTIME") {
        if value.eq_ignore_ascii_case("pyinstaller") {
            return BackendRuntime::PyInstaller;
        }
        if value.eq_ignore_ascii_case("script") {
            return BackendRuntime::Script;
        }
    }

    BackendRuntime::PyInstaller
}

/// Get the backend URL
pub fn get_backend_url() -> String {
    let port = BACKEND_PORT.load(Ordering::Relaxed);
    format!("http://127.0.0.1:{}", port)
}

/// Set the backend port
pub fn set_backend_port(port: u16) {
    BACKEND_PORT.store(port, Ordering::Relaxed);
}

/// Check if the backend is a LifeTrace server
async fn is_lifetrace_backend(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{}/health", port);
    let client = Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap_or_default();

    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(health) = response.json::<HealthResponse>().await {
                    return health.app.as_deref() == Some("lifetrace");
                }
            }
            false
        }
        Err(_) => false,
    }
}

/// Check backend health
pub async fn check_backend_health(
    port: u16,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("http://127.0.0.1:{}/health", port);
    let client = Client::builder()
        .timeout(Duration::from_millis(timeouts::HEALTH_CHECK))
        .build()?;

    match client.get(&url).send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Detect running backend server port
async fn detect_running_backend_port() -> Option<u16> {
    // Check priority ports first
    let priority_ports = [
        config::ports::DEV_BACKEND_PORT,
        config::ports::DEV_BACKEND_PORT + 1,
        config::ports::BUILD_BACKEND_PORT,
        config::ports::BUILD_BACKEND_PORT + 1,
    ];

    for port in priority_ports {
        if is_lifetrace_backend(port).await {
            info!("Detected backend running on port: {}", port);
            return Some(port);
        }
    }

    // Check other possible ports
    let start_port = config::ports::DEV_BACKEND_PORT + 2;
    let end_port = config::ports::DEV_BACKEND_PORT + 100;

    for port in start_port..end_port {
        if is_lifetrace_backend(port).await {
            info!("Detected backend running on port: {}", port);
            return Some(port);
        }
    }

    None
}

/// Wait for backend to be ready
async fn wait_for_backend(port: u16, timeout_secs: u64) -> Result<(), String> {
    let start = std::time::Instant::now();
    let timeout = Duration::from_secs(timeout_secs);
    let retry_interval = Duration::from_millis(timeouts::HEALTH_CHECK_RETRY);

    while start.elapsed() < timeout {
        if check_backend_health(port).await.unwrap_or(false) {
            return Ok(());
        }
        tokio::time::sleep(retry_interval).await;
    }

    Err("Backend did not start in time".to_string())
}

/// Find available port starting from default
async fn find_available_port(start_port: u16, max_attempts: u16) -> Result<u16, String> {
    for i in 0..max_attempts {
        let port = start_port + i;
        if !check_backend_health(port).await.unwrap_or(false) {
            // Port is likely available (not responding)
            return Ok(port);
        }
    }
    Err(format!(
        "Could not find available port after {} attempts",
        max_attempts
    ))
}

/// Start the Python backend server
pub async fn start_backend(
    app: &AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let backend_runtime = get_backend_runtime();
    info!("Detecting running backend server...");

    // Check if backend is already running
    if let Some(port) = detect_running_backend_port().await {
        set_backend_port(port);
        info!("Using existing backend server at port {}", port);
        start_health_check_loop(port);
        return Ok(());
    }

    info!("No running backend detected, starting new instance...");

    let backend_path = if backend_runtime == BackendRuntime::PyInstaller {
        match get_backend_path(app) {
            Ok(path) => path,
            Err(e) => {
                warn!("Backend executable not found: {}", e);
                if cfg!(debug_assertions) {
                    let port = config::get_backend_port();
                    info!(
                        "Development mode: waiting for external backend on port {}",
                        port
                    );
                    set_backend_port(port);
                    if wait_for_backend(port, 30).await.is_ok() {
                        info!("External backend is ready");
                        start_health_check_loop(port);
                        return Ok(());
                    }
                }
                return Err(e.into());
            }
        }
    } else {
        let backend_root = get_backend_script_root(app)?;
        get_backend_script_entry(&backend_root)
    };

    // Get data directory
    let data_dir = get_data_dir(app)?;

    // Find available port
    let port = find_available_port(config::get_backend_port(), 50).await?;
    set_backend_port(port);

    info!("Starting backend server...");
    info!("Backend runtime: {:?}", backend_runtime);
    info!("Backend path: {:?}", backend_path);
    info!("Data directory: {:?}", data_dir);
    info!("Port: {}", port);

    // Get server mode
    let mode = if cfg!(debug_assertions) {
        "dev"
    } else {
        "build"
    };

    let mut backend_workdir = backend_path.parent().unwrap_or(&backend_path).to_path_buf();

    let mut command = if backend_runtime == BackendRuntime::Script {
        let runtime_root = get_runtime_root(app)?;
        let venv_dir = runtime_root.join("python-venv");
        let system_python = find_python312().ok_or("Python 3.12 not found")?;
        let venv_python = ensure_venv(system_python.as_path(), venv_dir.as_path())?;
        let uv_path = ensure_uv(venv_python.as_path(), venv_dir.as_path())?;
        let backend_root = get_backend_script_root(app)?;
        let requirements_path = get_requirements_path(&backend_root);
        if !requirements_path.exists() {
            return Err(format!("Requirements file not found at {:?}", requirements_path).into());
        }
        install_requirements(
            uv_path.as_path(),
            venv_python.as_path(),
            requirements_path.as_path(),
        )?;

        backend_workdir = backend_root;
        let mut cmd = Command::new(venv_python);
        cmd.arg(backend_path);
        cmd
    } else {
        Command::new(&backend_path)
    };

    command
        .args([
            "--port",
            &port.to_string(),
            "--data-dir",
            data_dir.to_str().unwrap_or(""),
            "--mode",
            mode,
        ])
        .current_dir(backend_workdir)
        .env("PYTHONUNBUFFERED", "1")
        .env("PYTHONUTF8", "1")
        .env("LIFETRACE__OBSERVABILITY__ENABLED", "false")
        .env("LIFETRACE__SERVER__DEBUG", "false");

    let child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start backend: {}", e))?;

    // Store process reference
    {
        let mut guard = BACKEND_PROCESS.lock().unwrap();
        *guard = Some(child);
    }

    // Wait for backend to be ready
    info!("Waiting for backend server to be ready...");
    wait_for_backend(port, timeouts::BACKEND_READY / 1000).await?;
    info!("Backend server is ready at http://127.0.0.1:{}", port);

    // Verify backend mode
    verify_backend_mode(port, mode).await?;

    // Start health check loop
    start_health_check_loop(port);

    Ok(())
}

/// Verify backend server mode matches expected mode
async fn verify_backend_mode(port: u16, expected_mode: &str) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{}/health", port);
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    match client.get(&url).send().await {
        Ok(response) => {
            if let Ok(health) = response.json::<HealthResponse>().await {
                if health.app.as_deref() != Some("lifetrace") {
                    return Err(format!(
                        "Backend at port {} is not a LifeTrace server",
                        port
                    ));
                }
                if let Some(mode) = health.server_mode {
                    if mode != expected_mode {
                        warn!(
                            "Backend mode mismatch: expected '{}', got '{}'",
                            expected_mode, mode
                        );
                    }
                }
            }
            Ok(())
        }
        Err(e) => {
            warn!("Could not verify backend mode: {}", e);
            Ok(())
        }
    }
}

/// Start health check loop
fn start_health_check_loop(port: u16) {
    tokio::spawn(async move {
        let interval = Duration::from_millis(config::health_check::BACKEND_INTERVAL);

        loop {
            tokio::time::sleep(interval).await;

            if IS_STOPPING.load(Ordering::Relaxed) {
                break;
            }

            match check_backend_health(port).await {
                Ok(healthy) => {
                    if !healthy {
                        warn!("Backend health check failed");
                    }
                }
                Err(e) => {
                    warn!("Backend health check error: {}", e);
                }
            }
        }
    });
}

/// Stop the backend server
pub fn stop_backend() {
    IS_STOPPING.store(true, Ordering::Relaxed);

    let mut guard = BACKEND_PROCESS.lock().unwrap();
    if let Some(mut child) = guard.take() {
        info!("Stopping backend server...");

        // Try graceful shutdown first
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            unsafe {
                libc::kill(child.id() as i32, libc::SIGTERM);
            }
        }

        #[cfg(windows)]
        {
            // On Windows, try to terminate gracefully
            let _ = child.kill();
        }

        // Wait a bit for graceful shutdown
        std::thread::sleep(Duration::from_secs(2));

        // Force kill if still running
        match child.try_wait() {
            Ok(Some(_)) => {
                info!("Backend server stopped gracefully");
            }
            Ok(None) => {
                warn!("Backend server did not stop gracefully, forcing kill");
                let _ = child.kill();
            }
            Err(e) => {
                error!("Error checking backend status: {}", e);
                let _ = child.kill();
            }
        }
    }
}

/// Cleanup on application exit
pub fn cleanup() {
    stop_backend();
}
