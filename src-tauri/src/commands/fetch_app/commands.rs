use tauri::{AppHandle, Manager, State};

use crate::commands::fetch_app::{
    app_index::record_app_access,
    models::{AppInfo, AppIndexState},
};

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

    // Fill with popular apps if we don't have enough recent ones
    if recent_apps.len() < 5 {
        let mut popular_apps: Vec<AppInfo> = index
            .apps
            .values()
            .filter(|app| !recent_apps.iter().any(|a| a.id == app.id))
            .cloned()
            .collect();
            
        popular_apps.sort_by(|a, b| b.access_count.cmp(&a.access_count));
        
        for app in popular_apps {
            recent_apps.push(app);
            if recent_apps.len() >= 10 {
                break;
            }
        }
    }

    Ok(recent_apps)
}

// Open app and record access
#[tauri::command]
pub async fn open_app(
    app_id: String, 
    app_index_state: State<'_, AppIndexState>
) -> Result<(), String> {
    println!("Opening app with ID: {}", app_id);
    
    // Get the app path
    let path = {
        let mut index = app_index_state.index.lock().unwrap();
        let app = index.apps.get(&app_id).ok_or_else(|| format!("App not found with ID: {}", app_id))?;
        let path = app.path.clone();
        
        // Record this access
        record_app_access(&mut index, &app_id);
        
        path
    };

    println!("Launching app at path: {}", path);

    // Launch app
    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| format!("Failed to launch app: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn hide_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}