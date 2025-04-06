use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::SystemTime;
use tauri::State;
use uuid::Uuid;
use walkdir::WalkDir;

// Simple icon extraction using file paths as identifiers instead of actual extraction
fn extract_icon(path: &str) -> String {
    // Create a simple icon identifier based on file extension
    let extension = Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("exe")
        .to_lowercase();

    // Return different base64 encoded icons based on common file types
    match extension.as_str() {
        "exe" => {
            // For executables, use the file path hash as a unique identifier
            let hash = path
                .bytes()
                .fold(0u64, |acc, byte| acc.wrapping_add(byte as u64));
            format!("app-icon:{}", hash)
        }
        _ => "default-icon".to_string(),
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon: String,
    pub category: String,
    pub last_accessed: Option<u64>,
    pub access_count: u32,
}

#[derive(Default, Serialize, Deserialize)]
struct AppIndex {
    apps: HashMap<String, AppInfo>,
    last_update: u64,
}

pub struct AppIndexState {
    index: Arc<Mutex<AppIndex>>,
}

// Function to categorize applications
fn categorize_app(path: &str, name: &str) -> String {
    let path_lower = path.to_lowercase();
    let name_lower = name.to_lowercase();

    // 1. System components first
    if path_lower.contains("\\system32\\") 
        || path_lower.contains("\\windows\\system\\")
        || path_lower.contains("\\windows kits\\")
        || path_lower.contains("\\driverstore\\")
    {
        return "System Tools".to_string();
    }

    // 2. Path-based categorization (most specific first)
    if path_lower.contains("\\steam\\") 
        || path_lower.contains("\\epic games\\")
        || path_lower.contains("\\ubisoft\\")
        || path_lower.contains("\\riot games\\")
    {
        return "Games".to_string();
    }

    if path_lower.contains("\\microsoft office\\") 
        || path_lower.contains("\\libreoffice\\")
        || path_lower.contains("\\openoffice\\")
    {
        return "Office".to_string();
    }

    if path_lower.contains("\\spotify\\")
        || path_lower.contains("\\vlc\\")
        || path_lower.contains("\\winamp\\")
        || path_lower.contains("\\itunes\\")
    {
        return "Media".to_string();
    }

    if path_lower.contains("\\discord\\")
        || path_lower.contains("\\slack\\")
        || path_lower.contains("\\whatsapp\\")
        || path_lower.contains("\\telegram\\")
    {
        return "Social".to_string();
    }

    if path_lower.contains("\\adobe\\")
        || path_lower.contains("\\gimp\\")
        || path_lower.contains("\\blender\\")
        || path_lower.contains("\\corel\\")
    {
        return "Design".to_string();
    }

    if path_lower.contains("\\microsoft vs code\\")
        || path_lower.contains("\\jetbrains\\")
        || path_lower.contains("\\github\\")
        || path_lower.contains("\\nodejs\\")
    {
        return "Development".to_string();
    }

    // 3. Name-based categorization
    let category_from_name = match name_lower.as_str() {
        n if n.contains("browser") || n.contains("nav") || n.contains("web") => "Browsers",
        n if n.contains("word") || n.contains("excel") || n.contains("powerpoint") => "Office",
        n if n.contains("steam") || n.contains("launcher") || n.contains("game") => "Games",
        n if n.contains("spotify") || n.contains("player") || n.contains("music") => "Media",
        n if n.contains("discord") || n.contains("chat") || n.contains("message") => "Social",
        n if n.contains("code") || n.contains("studio") || n.contains("dev") => "Development",
        n if n.contains("photo") || n.contains("paint") || n.contains("draw") => "Design",
        n if n.contains("zip") || n.contains("cleaner") || n.contains("tool") => "Utilities",
        _ => "",
    };

    if !category_from_name.is_empty() {
        return category_from_name.to_string();
    }

    // 4. Program Files publisher analysis
    if path_lower.contains("\\program files") {
        let parts: Vec<&str> = path.split('\\').collect();
        if parts.len() > 3 {
            match parts[3].to_lowercase().as_str() {
                "valve" | "epic games" | "ubisoft" => return "Games".to_string(),
                "microsoft office" | "libreoffice" => return "Office".to_string(),
                "adobe" | "corel" | "blender foundation" => return "Design".to_string(),
                "mozilla" | "google" => return "Browsers".to_string(),
                "jetbrains" | "github" => return "Development".to_string(),
                _ => {}
            }
        }
    }

    // 5. Fallback to directory structure analysis
    if path_lower.contains("\\games\\") {
        "Games"
    } else if path_lower.contains("\\development\\") {
        "Development"
    } else if path_lower.contains("\\creative\\") {
        "Design"
    } else {
        // Default category for unrecognized apps
        "Applications"
    }.to_string()
}

// Function to get the index file path
fn get_index_path() -> PathBuf {
    let mut path = tauri::api::path::app_data_dir(&tauri::Config::default()).unwrap();
    path.push("app_index.json");
    path
}

// Load the app index from disk
fn load_app_index() -> AppIndex {
    let path = get_index_path();
    println!("{:?}", path);
    if path.exists() {
        match File::open(&path) {
            Ok(mut file) => {
                let mut contents = String::new();
                if file.read_to_string(&mut contents).is_ok() {
                    if let Ok(index) = serde_json::from_str(&contents) {
                        return index;
                    }
                }
            }
            Err(_) => {}
        }
    }

    // Return empty index if file doesn't exist or can't be read
    AppIndex {
        apps: HashMap::new(),
        last_update: 0,
    }
}

// Save the app index to disk
fn save_app_index(index: &AppIndex) -> Result<(), String> {
    let path = get_index_path();

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(index).map_err(|e| e.to_string())?;
    let mut file = File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

// Build app index
fn build_app_index() -> Result<AppIndex, String> {
    let mut index = load_app_index();
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if now - index.last_update < 3600 && !index.apps.is_empty() {
        return Ok(index);
    }

    let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
    let appdata_local = format!("{}\\AppData\\Local", user_profile);
    let appdata_roaming = format!("{}\\AppData\\Roaming", user_profile);
    let start_menu = format!("{}\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs", user_profile);

    // Focus on user-accessible locations (removed System32)
    let search_paths = vec![
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        &appdata_local,
        &appdata_roaming,
        &start_menu,
    ];

    // Common system utilities to exclude (add more as needed)
    let system_tool_blacklist = [
        "ipconfig", "disksnapshot", "cmd", "powershell", "msconfig", "eventvwr",
        "taskmgr", "chkdsk", "sfc", "diskpart", "netsh", "ping", "tracert",
    ];

    let mut seen_paths = HashSet::new();
    let mut new_apps = HashMap::new();

    for (id, app) in &index.apps {
        new_apps.insert(id.clone(), app.clone());
        seen_paths.insert(app.path.clone());
    }

    for base_path in search_paths {
        let walker = WalkDir::new(base_path).max_depth(5).into_iter(); // Increased depth
        for entry in walker.filter_map(|e| e.ok()) {
            if entry.path().extension().map_or(false, |ext| ext == "exe") {
                let path_str = entry.path().to_string_lossy().to_string();

                if seen_paths.contains(&path_str) {
                    continue;
                }

                let name = entry.path()
                    .file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                // Enhanced filtering
                let is_system_tool = system_tool_blacklist.contains(&name.as_str()) ||
                    path_str.to_lowercase().contains("system32") ||
                    path_str.to_lowercase().contains("windows\\system") ||
                    name.len() <= 2 ||
                    name.starts_with("unins");

                if is_system_tool {
                    continue;
                }

                seen_paths.insert(path_str.clone());

                let category = categorize_app(&path_str, &name);
                let icon = extract_icon(&path_str);

                let id = Uuid::new_v4().to_string();
                let app_info = AppInfo {
                    id: id.clone(),
                    name: name.clone(),
                    path: path_str,
                    icon,
                    category,
                    last_accessed: None,
                    access_count: 0,
                };

                new_apps.insert(id, app_info);
            }
        }
    }

    index.apps = new_apps;
    index.last_update = now;
    save_app_index(&index)?;

    Ok(index)
}

// Initialize app index state
pub fn init_app_index() -> AppIndexState {
    let index = Arc::new(Mutex::new(AppIndex::default()));
    let index_clone = index.clone();

    // Launch background thread to build index
    thread::spawn(move || {
        if let Ok(new_index) = build_app_index() {
            let mut index = index_clone.lock().unwrap();
            *index = new_index;
        }
    });

    AppIndexState { index }
}

// Schedule periodic index updates
// pub fn schedule_index_updates(app_index: Arc<Mutex<AppIndex>>) {
//     thread::spawn(move || {
//         loop {
//             thread::sleep(Duration::from_secs(3600)); // Update every hour
//             if let Ok(new_index) = build_app_index() {
//                 let mut index = app_index.lock().unwrap();
//                 *index = new_index;
//             }
//         }
//     });
// }

// Record app access
// fn record_app_access(index: &mut AppIndex, app_id: &str) {
//     if let Some(app) = index.apps.get_mut(app_id) {
//         app.access_count += 1;
//         app.last_accessed = Some(
//             SystemTime::now()
//                 .duration_since(SystemTime::UNIX_EPOCH)
//                 .unwrap_or_default()
//                 .as_secs(),
//         );

//         // Save updated index
//         let _ = save_app_index(index);
//     }
// }

#[tauri::command]
pub async fn get_index_status(
    app_index_state: State<'_, AppIndexState>,
) -> Result<serde_json::Value, String> {
    let index = app_index_state.index.lock().unwrap();
    let building = index.apps.is_empty() || index.last_update == 0;

    Ok(serde_json::json!({
        "building": building,
        "app_count": index.apps.len(),
        "last_update": index.last_update
    }))
}

// Search apps in the index
#[tauri::command]
pub async fn search_apps(
    query: String,
    app_index_state: State<'_, AppIndexState>,
) -> Result<Vec<AppInfo>, String> {
    let index = app_index_state.index.lock().unwrap();
    let query = query.to_lowercase();

    let mut matching_apps: Vec<AppInfo> = index
        .apps
        .values()
        .filter(|app| app.name.to_lowercase().contains(&query))
        .cloned()
        .collect();

    // Sort by relevance (exact match first, then by access count)
    matching_apps.sort_by(|a, b| {
        let a_exact = a.name.to_lowercase() == query;
        let b_exact = b.name.to_lowercase() == query;

        if a_exact && !b_exact {
            std::cmp::Ordering::Less
        } else if !a_exact && b_exact {
            std::cmp::Ordering::Greater
        } else {
            b.access_count.cmp(&a.access_count)
        }
    });

    // Limit results
    matching_apps.truncate(10);

    println!("{:?}", matching_apps);

    Ok(matching_apps)
}

// Get recently used apps
#[tauri::command]
pub async fn get_recent_apps(
    app_index_state: State<'_, AppIndexState>,
) -> Result<Vec<AppInfo>, String> {
    let index = app_index_state.index.lock().unwrap();

    let mut recent_apps: Vec<AppInfo> = index
        .apps
        .values()
        .filter(|app| app.last_accessed.is_some())
        .cloned()
        .collect();

    // Sort by last accessed time (most recent first)
    recent_apps.sort_by(|a, b| {
        b.last_accessed
            .unwrap_or(0)
            .cmp(&a.last_accessed.unwrap_or(0))
    });

    // Limit results
    recent_apps.truncate(10);

    // If we don't have enough recent apps, add some common ones
    if recent_apps.len() < 5 {
        let common_paths = vec![
            "C:\\Windows\\System32\\cmd.exe",
            "C:\\Windows\\System32\\notepad.exe",
            "C:\\Windows\\explorer.exe",
            "C:\\Windows\\System32\\control.exe",
        ];

        for app in index.apps.values() {
            if common_paths.contains(&app.path.as_str())
                && !recent_apps.iter().any(|a| a.path == app.path)
            {
                recent_apps.push(app.clone());
                if recent_apps.len() >= 10 {
                    break;
                }
            }
        }
    }

    Ok(recent_apps)
}

// Open app and record access
#[tauri::command]
pub async fn open_app(path: String) -> Result<(), String> {
    // Launch app directly using the path
    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}
