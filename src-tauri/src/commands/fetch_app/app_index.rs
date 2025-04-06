use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::SystemTime;

use crate::commands::fetch_app::{
    app_registry::read_installed_apps,
    models::{AppIndex, AppIndexState},
};

// Function to get the index file path
pub fn get_index_path() -> PathBuf {
    let mut path = tauri::api::path::app_data_dir(&tauri::Config::default()).unwrap();
    path.push("app_index.json");
    path
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
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(index).map_err(|e| e.to_string())?;
    let mut file = File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

// Build app index from registry
pub fn build_app_index() -> Result<AppIndex, String> {
    let mut index = load_app_index();
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Only update if older than 1 hour
    if now - index.last_update < 3600 && !index.apps.is_empty() {
        return Ok(index);
    }

    // Get installed apps from registry
    let new_apps = read_installed_apps()?;
    
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