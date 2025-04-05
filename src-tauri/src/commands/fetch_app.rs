use std::collections::HashSet;
use walkdir::WalkDir;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
    pub icon: String,
}

// Function to extract icon from exe file (placeholder)
fn get_exe_icon(_path: &str) -> String {
    // For now, return a default icon. In a real implementation, 
    // you would extract the icon from the exe file using the Windows API
    "default_icon".to_string()
}

#[tauri::command]
pub async fn search_apps(query: String) -> Result<Vec<AppInfo>, String> {
    let mut apps = Vec::new();
    
    // Create owned strings for the user paths
    let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
    let appdata_local = format!("{}\\AppData\\Local", user_profile);
    let appdata_roaming = format!("{}\\AppData\\Roaming", user_profile);

    let search_paths = vec![
        "C:\\Windows\\System32",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        &appdata_local,
        &appdata_roaming,
    ];

    let query = query.to_lowercase();
    let mut seen_paths = HashSet::new();

    for base_path in search_paths {
        let walker = WalkDir::new(base_path).max_depth(3).into_iter();
        for entry in walker.filter_map(|e| e.ok()) {
            if entry.path().extension().map_or(false, |ext| ext == "exe") {
                let path_str = entry.path().to_string_lossy().to_string();
                
                // Skip if we've seen this path before
                if seen_paths.contains(&path_str) {
                    continue;
                }
                
                let file_name = entry.path().file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                if file_name.contains(&query) {
                    seen_paths.insert(path_str.clone());
                    
                    apps.push(AppInfo {
                        name: entry.path().file_stem()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string(),
                        path: path_str,
                        icon: get_exe_icon(entry.path().to_str().unwrap_or("")),
                    });

                    // Limit results to prevent too many matches
                    if apps.len() >= 10 {
                        break;
                    }
                }
            }
        }
    }

    Ok(apps)
}

#[tauri::command]
pub async fn get_recent_apps() -> Result<Vec<AppInfo>, String> {
    // In a real implementation, you would track and store recently used apps
    // For now, return some common Windows apps as an example
    let common_apps = vec![
        ("Command Prompt", "C:\\Windows\\System32\\cmd.exe"),
        ("Notepad", "C:\\Windows\\System32\\notepad.exe"),
        ("File Explorer", "C:\\Windows\\explorer.exe"),
        ("Control Panel", "C:\\Windows\\System32\\control.exe"),
        ("Task Manager", "C:\\Windows\\System32\\Taskmgr.exe"),
    ];

    Ok(common_apps
        .into_iter()
        .map(|(name, path)| AppInfo {
            name: name.to_string(),
            path: path.to_string(),
            icon: get_exe_icon(path),
        })
        .collect())
}

#[tauri::command]
pub async fn open_app(path: String) -> Result<(), String> {
    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn search_files(query: String) -> Result<(), String> {
    // Implement file search functionality
    println!("Searching files for: {}", query);
    Ok(())
}
