#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod config_file;
use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct PersistenceState { saving: AtomicBool, writer: Mutex<()> }

#[tauri::command]
fn load_configuration(app: tauri::AppHandle) -> Result<Option<String>, String> {
    config_file::read(&app.path().app_data_dir().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn load_preferences(app: tauri::AppHandle) -> Result<Option<String>, String> {
    config_file::read_named(&app.path().app_data_dir().map_err(|e| e.to_string())?, "preferences.json")
}

#[tauri::command]
async fn save_preferences(app: tauri::AppHandle, text: String) -> Result<(), String> {
    save_record(app, text, config_file::save_preferences).await
}

#[tauri::command]
fn configuration_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join(config_file::FILE_NAME).display().to_string())
}

#[tauri::command]
async fn save_configuration(app: tauri::AppHandle, text: String) -> Result<(), String> {
    save_record(app, text, config_file::save).await
}

async fn save_record(
    app: tauri::AppHandle,
    text: String,
    write: fn(&std::path::Path, &str) -> Result<(), String>,
) -> Result<(), String> {
    let state = app.state::<PersistenceState>();
    if state.saving.swap(true, Ordering::SeqCst) { return Err("已有保存正在进行，请稍后重试".into()); }
    let worker = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let state = worker.state::<PersistenceState>();
        let _lock = state.writer.lock().map_err(|e| e.to_string())?;
        write(&worker.path().app_data_dir().map_err(|e| e.to_string())?, &text)
    }).await.map_err(|e| e.to_string()).and_then(|result| result);
    state.saving.store(false, Ordering::SeqCst);
    result
}

#[tauri::command]
async fn export_configuration(app: tauri::AppHandle, text: String, filename: String) -> Result<bool, String> {
    let selected = tauri::async_runtime::spawn_blocking(move || app.dialog().file().add_filter("JSON 配置备份", &["json"]).set_file_name(filename).blocking_save_file())
        .await.map_err(|e| e.to_string())?;
    let Some(selected) = selected else { return Ok(false); };
    let path = selected.into_path().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || config_file::export_file(&path, &text)).await.map_err(|e| e.to_string())??;
    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(PersistenceState::default())
        .invoke_handler(tauri::generate_handler![load_configuration, save_configuration, export_configuration, configuration_path, load_preferences, save_preferences])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.state::<PersistenceState>().saving.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.emit("save-in-progress", ());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("unable to run Tuition Payback Timer");
}
