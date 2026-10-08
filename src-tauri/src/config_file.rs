use std::{fs::{self, File, OpenOptions}, io::{Read, Write}, path::Path, time::{SystemTime, UNIX_EPOCH}};

pub const FILE_NAME: &str = "configuration.json";
const MAX_BYTES: usize = 1024 * 1024;

pub fn read(directory: &Path) -> Result<Option<String>, String> {
    read_named(directory, FILE_NAME)
}

pub fn read_named(directory: &Path, name: &str) -> Result<Option<String>, String> {
    let file = match File::open(directory.join(name)) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    let mut bytes = Vec::new();
    file.take((MAX_BYTES + 1) as u64).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_BYTES { return Err("配置文件超过 1 MB，原文件已保留".into()); }
    String::from_utf8(bytes).map(Some).map_err(|_| "配置文件不是 UTF-8，原文件已保留".into())
}

fn write_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path).map_err(|e| e.to_string())?;
    file.write_all(bytes).and_then(|_| file.sync_all()).map_err(|e| e.to_string())
}

pub fn save(directory: &Path, text: &str) -> Result<(), String> {
    if text.len() > MAX_BYTES { return Err("配置文件超过 1 MB".into()); }
    let value: serde_json::Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
    if (value["version"] != 3 && value["version"] != 4) || !value["semester"].is_object() { return Err("只能保存已校验的版本 3 或 4 配置".into()); }
    save_named(directory, FILE_NAME, text)
}

pub fn save_preferences(directory: &Path, text: &str) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
    let languages = ["zh-CN", "en-US", "ja-JP", "zh-TW", "ko-KR", "es-ES"];
    let currencies = ["USD", "CNY", "JPY", "EUR", "GBP", "HKD", "TWD", "KRW", "CAD", "AUD", "SGD", "CHF"];
    if value["version"] != 1 || !value["language"].as_str().is_some_and(|v| languages.contains(&v))
        || !value["currency"].as_str().is_some_and(|v| currencies.contains(&v)) {
        return Err("语言或货币设置无效，请重新选择。".into());
    }
    save_named(directory, "preferences.json", text)
}

fn save_named(directory: &Path, name: &str, text: &str) -> Result<(), String> {
    if text.len() > MAX_BYTES { return Err("配置文件超过 1 MB".into()); }
    fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let unique = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let target = directory.join(name);
    let stem = name.trim_end_matches(".json");
    let temporary = directory.join(format!("{stem}-{unique}.tmp"));
    let result = (|| {
        write_new(&temporary, text.as_bytes())?;
        // Back up raw bytes, including an invalid or unknown old record.
        match File::open(&target) {
            Ok(mut previous) => {
                let mut backup = OpenOptions::new().write(true).create_new(true)
                    .open(directory.join(format!("{stem}.previous-{unique}.json"))).map_err(|e| e.to_string())?;
                std::io::copy(&mut previous, &mut backup).and_then(|_| backup.sync_all()).map_err(|e| e.to_string())?;
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {},
            Err(error) => return Err(error.to_string()),
        }
        fs::rename(&temporary, &target).map_err(|e| e.to_string())
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

pub fn export_file(path: &Path, text: &str) -> Result<(), String> {
    let directory = path.parent().ok_or("备份路径无效")?;
    let unique = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let temporary = directory.join(format!("tuition-export-{unique}.tmp"));
    let result = write_new(&temporary, text.as_bytes()).and_then(|_| fs::rename(&temporary, path).map_err(|e| e.to_string()));
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    fn directory() -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("tuition-persistence-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&path).unwrap();
        path
    }
    fn clean(path: std::path::PathBuf) {
        let checked = fs::canonicalize(path).unwrap();
        assert!(checked.starts_with(fs::canonicalize(std::env::temp_dir()).unwrap()));
        assert!(checked.file_name().unwrap().to_string_lossy().starts_with("tuition-persistence-"));
        fs::remove_dir_all(checked).unwrap();
    }
    #[test]
    fn added_languages_can_save_and_reopen_without_changing_timetable() {
        let path = directory();
        let config = r#"{"version":4,"semester":{"tuitionCents":3600000}}"#;
        save(&path, config).unwrap();
        for (language, currency) in [("zh-TW", "USD"), ("ko-KR", "KRW"), ("es-ES", "EUR")] {
            let text = serde_json::json!({"version":1,"language":language,"currency":currency}).to_string();
            save_preferences(&path, &text).unwrap();
            assert_eq!(read_named(&path, "preferences.json").unwrap().unwrap(), text);
            assert_eq!(read(&path).unwrap().unwrap(), config);
        }
        clean(path);
    }
    #[test]
    fn preferences_are_independent_and_invalid_values_do_not_overwrite() {
        let path = directory();
        let config = r#"{"version":4,"semester":{"tuitionCents":3600000}}"#;
        save(&path, config).unwrap();
        let prefs = r#"{"version":1,"language":"en-US","currency":"JPY"}"#;
        save_preferences(&path, prefs).unwrap();
        assert_eq!(read_named(&path, "preferences.json").unwrap().unwrap(), prefs);
        assert_eq!(read(&path).unwrap().unwrap(), config);
        assert!(save_preferences(&path, r#"{"version":1,"language":"en-US","currency":"BAD"}"#).is_err());
        assert_eq!(read_named(&path, "preferences.json").unwrap().unwrap(), prefs);
        clean(path);
    }
    #[test]
    fn overwrite_and_reopen_preserve_previous_bytes() {
        let path = directory();
        assert_eq!(read(&path).unwrap(), None);
        let original = r#"{"version":3,"semester":{"tuitionCents":100}}"#;
        let upgraded = r#"{"version":3,"semester":{"tuitionCents":200}}"#;
        save(&path, original).unwrap();
        save(&path, upgraded).unwrap();
        assert_eq!(read(&path).unwrap().unwrap(), upgraded);
        let backup = fs::read_dir(&path).unwrap().map(|e| e.unwrap().path()).find(|p| p.extension().is_some_and(|e| e == "json") && p.file_name().unwrap() != FILE_NAME).unwrap();
        assert_eq!(fs::read_to_string(backup).unwrap(), original);
        clean(path);
    }
    #[test]
    fn malformed_and_unknown_are_never_rewritten_by_loading() {
        let path = directory();
        for text in ["broken", r#"{"version":99}"#, r#"{"version":1,"session":{}}"#] {
            fs::write(path.join(FILE_NAME), text).unwrap();
            assert_eq!(read(&path).unwrap().unwrap(), text);
            assert!(save(&path, text).is_err());
            assert_eq!(fs::read_to_string(path.join(FILE_NAME)).unwrap(), text);
        }
        clean(path);
    }
    #[test]
    fn failed_write_does_not_replace_existing_data() {
        let path = directory();
        let text = r#"{"version":3,"semester":{}}"#;
        save(&path, text).unwrap();
        let mut permissions = fs::metadata(path.join(FILE_NAME)).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(path.join(FILE_NAME), permissions).unwrap();
        assert!(save(&path, r#"{"version":3,"semester":{"new":true}}"#).is_err());
        assert_eq!(read(&path).unwrap().unwrap(), text);
        let mut permissions = fs::metadata(path.join(FILE_NAME)).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(path.join(FILE_NAME), permissions).unwrap();
        clean(path);
    }
}
