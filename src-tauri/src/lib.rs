mod config_file;
use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
use tauri::Manager;
#[cfg(desktop)]
use tauri::Emitter;
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
    // iOS exports an existing document rather than granting an arbitrary write path.
    // Populate the document before the dialog copies it to the selected provider.
    #[cfg(target_os = "ios")]
    {
        if std::path::Path::new(&filename).file_name().and_then(|s| s.to_str()) != Some(filename.as_str()) {
            return Err("Invalid backup filename".into());
        }
        let directory = app.path().document_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        config_file::export_file(&directory.join(&filename), &text)?;
    }
    let selected = tauri::async_runtime::spawn_blocking(move || app.dialog().file().add_filter("JSON 配置备份", &["json"]).set_file_name(filename).blocking_save_file())
        .await.map_err(|e| e.to_string())?;
    let Some(selected) = selected else { return Ok(false); };
    #[cfg(not(target_os = "ios"))]
    {
        let path = selected.into_path().map_err(|e| e.to_string())?;
        tauri::async_runtime::spawn_blocking(move || config_file::export_file(&path, &text)).await.map_err(|e| e.to_string())??;
    }
    #[cfg(target_os = "ios")]
    let _ = selected;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); }
        }));
    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .manage(PersistenceState::default())
        .invoke_handler(tauri::generate_handler![load_configuration, save_configuration, export_configuration, configuration_path, load_preferences, save_preferences, runtime_platform, sync_widget]);
    #[cfg(desktop)]
    let builder = builder
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.state::<PersistenceState>().saving.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.emit("save-in-progress", ());
                }
            }
        });
    builder.run(tauri::generate_context!())
        .expect("unable to run Tuition Payback Timer");
}

#[tauri::command]
fn runtime_platform() -> &'static str { std::env::consts::OS }

// Linked by the iOS host only. The App Group is a derived, read-only widget
// snapshot; original configuration and its backups remain in native storage.
#[tauri::command]
fn sync_widget(text: String) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let write = WIDGET_WRITER.get().ok_or("Widget bridge is not installed")?;
        if text.len() > 16 * 1024 * 1024 { return Err("Widget snapshot is too large".into()); }
        let text = std::ffi::CString::new(text).map_err(|e| e.to_string())?;
        if unsafe { write(text.as_ptr()) } != 0 {
            return Err("Unable to write widget App Group snapshot".into());
        }
    }
    #[cfg(not(target_os = "ios"))]
    let _ = text;
    Ok(())
}

#[cfg(target_os = "ios")]
static WIDGET_WRITER: std::sync::OnceLock<unsafe extern "C" fn(*const std::ffi::c_char) -> i32> = std::sync::OnceLock::new();

// Register from the host before start_app. A callback avoids an unresolved Swift
// symbol when Cargo builds its standalone cdylib alongside the iOS staticlib.
#[cfg(target_os = "ios")]
#[no_mangle]
pub extern "C" fn tuition_widget_register(writer: unsafe extern "C" fn(*const std::ffi::c_char) -> i32) {
    let _ = WIDGET_WRITER.set(writer);
}
