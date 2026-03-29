use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

struct SidecarState(Mutex<Option<Child>>);

#[tauri::command]
fn get_sidecar_port() -> u16 {
    8765
}

/// Check for an available app update.
/// Returns `{available: bool, version?: string, notes?: string}`.
#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri_plugin_updater::UpdaterExt;
    match app.updater().map_err(|e| e.to_string())?.check().await {
        Ok(Some(update)) => Ok(serde_json::json!({
            "available": true,
            "version": update.version,
            "notes": update.body.unwrap_or_default(),
        })),
        Ok(None) => Ok(serde_json::json!({ "available": false })),
        Err(e) => Err(e.to_string()),
    }
}

/// Download and install a pending update (triggers restart on next launch).
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(update) = update {
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Restart the application (call after install_update completes).
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SidecarState(Mutex::new(None)))
        .setup(|app| {
            // Spawn the Python sidecar
            let _sidecar_path = app
                .path()
                .resource_dir()
                .unwrap_or_default()
                .join("sidecar")
                .join("universe-ai-sidecar");

            // In development, run via Python directly
            #[cfg(debug_assertions)]
            {
                let sidecar_dir = std::env::current_dir()
                    .unwrap_or_default()
                    .parent()
                    .unwrap_or(&std::path::PathBuf::from("."))
                    .join("sidecar");

                let venv_python = sidecar_dir.join(".venv").join("Scripts").join("python.exe");
                let python_bin = if venv_python.exists() {
                    venv_python
                } else {
                    std::path::PathBuf::from("python")
                };
                let child = Command::new(&python_bin)
                    .arg(sidecar_dir.join("main.py"))
                    .current_dir(&sidecar_dir)
                    .spawn();

                match child {
                    Ok(c) => {
                        *app.state::<SidecarState>().0.lock().unwrap() = Some(c);
                        println!("[universe-ai] Python sidecar started");
                    }
                    Err(e) => {
                        eprintln!("[universe-ai] Failed to start sidecar: {e}");
                        eprintln!(
                            "[universe-ai] Run manually: cd sidecar && python main.py"
                        );
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Kill sidecar on close
                if let Ok(mut guard) = window.app_handle().state::<SidecarState>().0.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_sidecar_port,
            check_for_update,
            install_update,
            restart_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
