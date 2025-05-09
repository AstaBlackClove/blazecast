use uuid::Uuid;

use crate::commands::fetch_app::icons::extract_icon;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::SystemTime;

use crate::commands::fetch_app::{
    app_registry::read_installed_apps,
    models::{AppIndex, AppIndexState},
};

use super::app_registry::parse_shortcut;
use super::categorization::categorize_app;
use super::models::AppInfo;

// Function to get the index file path
pub fn get_index_path() -> PathBuf {
    let mut path = tauri::api::path::app_data_dir(&tauri::Config::default()).unwrap();
    path.push("app_index.json");
    path
}

pub fn add_manual_app(name: String, path: String) -> Result<AppInfo, String> {
    // Validate basic path existence - this is a bit tricky with args
    let path_parts: Vec<&str> = path.split_whitespace().collect();
    let exe_path = if path.to_lowercase().ends_with(".lnk") {
        parse_shortcut(Path::new(&path))?
    } else {
        path_parts[0].trim_matches('"').to_string()
    };

    if !Path::new(&exe_path).exists() {
        return Err(format!("Executable path does not exist: {}", exe_path));
    }

    // Load the current app index
    let mut index = load_app_index();

    // Check for duplicates by path or name
    let mut existing_id = None;
    for (id, app) in &index.apps {
        // Check if the path (without arguments) or the exact path match
        let app_exe_path = app
            .path
            .split_whitespace()
            .next()
            .unwrap_or("")
            .trim_matches('"');
        if app_exe_path == exe_path || app.path == path {
            existing_id = Some(id.clone());
            break;
        }

        // Optional: Also check by name if you want to prevent duplicate names
        if app.name.to_lowercase() == name.to_lowercase() {
            existing_id = Some(id.clone());
            break;
        }
    }

    // Extract icon from the executable path
    let icon = extract_icon(&exe_path).unwrap_or_default();

    // Categorize the app
    let category = categorize_app(&exe_path, &name);

    // If a duplicate exists, update that entry instead of creating a new one
    if let Some(id) = existing_id {
        let app_info = AppInfo {
            id: id.clone(),
            name,
            path, // Store the full path with arguments
            icon,
            category,
            // Preserve access statistics
            last_accessed: index.apps.get(&id).and_then(|app| app.last_accessed),
            access_count: index.apps.get(&id).map_or(0, |app| app.access_count),
        };

        // Add the new app to the index
        index.apps.insert(id, app_info.clone());

        // Save the updated index
        match save_app_index(&index) {
            Ok(_) => println!("Successfully saved app index"),
            Err(e) => println!("Error saving app index: {}", e),
        }

        return Ok(app_info);
    }

    // No duplicate found, generate a new UUID for the app
    let id = Uuid::new_v4().to_string();

    // Create the new app info
    let app_info = AppInfo {
        id: id.clone(),
        name,
        path, // Store the full path with arguments
        icon,
        category,
        last_accessed: None,
        access_count: 0,
    };

    // Add the new app to the index
    index.apps.insert(id, app_info.clone());

    // Save the updated index
    save_app_index(&index)?;

    Ok(app_info)
}

// Load the app index from disk
pub fn load_app_index() -> AppIndex {
    let path = get_index_path();
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
        apps: Default::default(),
        last_update: 0,
    }
}

// Save the app index to disk
pub fn save_app_index(index: &AppIndex) -> Result<(), String> {
    let path = get_index_path();

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        match fs::create_dir_all(parent) {
            Ok(_) => println!("Directory created or already exists"),
            Err(e) => {
                println!("Error creating directory: {}", e);
                return Err(e.to_string());
            }
        }
    }

    let json = match serde_json::to_string_pretty(index) {
        Ok(j) => j,
        Err(e) => {
            println!("Error serializing index to JSON: {}", e);
            return Err(e.to_string());
        }
    };

    match File::create(&path) {
        Ok(mut file) => match file.write_all(json.as_bytes()) {
            Ok(_) => println!("Successfully wrote index file"),
            Err(e) => {
                println!("Error writing to index file: {}", e);
                return Err(e.to_string());
            }
        },
        Err(e) => {
            println!("Error creating index file: {}", e);
            return Err(e.to_string());
        }
    }

    // Add verification after write
    match fs::read_to_string(&path) {
        Ok(contents) => {
            // Check if our file has valid JSON
            match serde_json::from_str::<AppIndex>(&contents) {
                Ok(read_index) => println!(
                    "Verified file contains valid index with {} apps",
                    read_index.apps.len()
                ),
                Err(e) => println!("Warning: File exists but contains invalid JSON: {}", e),
            }
        }
        Err(e) => println!("Warning: Could not read back file: {}", e),
    }

    Ok(())
}

// Build app index from registry
pub fn build_app_index(force: bool) -> Result<AppIndex, String> {
    let mut index = load_app_index();
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Save existing manual entries
    let existing_apps = index.apps.clone();

    // Only update if older than 1 hour
    if !force && now - index.last_update < 3600 && !index.apps.is_empty() {
        return Ok(index);
    }

    // Get installed apps from registry
    let new_apps = read_installed_apps()?;

    index.apps = new_apps;

    // Preserve existing entries that might have been added manually
    for (id, app) in existing_apps {
        // Only keep apps that aren't already in the new list
        // We can check by path or some other identifier
        if !index.apps.values().any(|a| a.path == app.path) {
            index.apps.insert(id, app);
        }
    }

    index.last_update = now;
    save_app_index(&index)?;

    Ok(index)
}

pub fn refresh_app_index(app_index_state: &AppIndexState) {
    let index_clone = app_index_state.index.clone();

    // Launch background thread to rebuild index
    thread::spawn(move || {
        if let Ok(new_index) = build_app_index(true) {
            let mut index = index_clone.lock().unwrap();
            *index = new_index;
        } else {
            println!("Background thread: Failed to build app index");
        }
    });
}

// Initialize app index state
pub fn init_app_index() -> AppIndexState {
    let index = Arc::new(Mutex::new(AppIndex::default()));
    let index_clone = index.clone();

    // Launch background thread to build index
    thread::spawn(move || {
        if let Ok(new_index) = build_app_index(false) {
            let mut index = index_clone.lock().unwrap();
            *index = new_index;
        }
    });

    AppIndexState { index }
}

// Record app access
pub fn record_app_access(index: &mut AppIndex, app_id: &str) {
    if let Some(app) = index.apps.get_mut(app_id) {
        app.access_count += 1;
        app.last_accessed = Some(
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        );

        // Save updated index
        let _ = save_app_index(index);
    }
}
