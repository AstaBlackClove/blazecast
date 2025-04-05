use std::fs;

#[tauri::command]
pub fn fetch_installed_apps() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let program_files = "C:\\Program Files";
        let entries = fs::read_dir(program_files).map_err(|e| e.to_string())?;

        let apps = entries
            .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
            .collect::<Vec<String>>();

        Ok(apps)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Fetching installed apps is only supported on Windows.".to_string())
    }
}

#[tauri::command]
pub fn open_app(path: String) -> Result<(), String> {
    std::process::Command::new(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
