use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::commands::quick_link::models::QuickLink;
use crate::commands::quick_link::state::QuickLinkState;

// Helper function to get quick links directory
pub fn get_quick_links_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "Failed to get app data directory".to_string())?;

    let quick_links_dir = app_dir.join("quick_links");
    Ok(quick_links_dir)
}

// Save a quick link to disk
pub fn save_quick_link_to_disk(
    app_handle: &AppHandle,
    quick_link: &QuickLink,
) -> Result<(), String> {
    let quick_links_dir = get_quick_links_dir(app_handle)?;
    if !quick_links_dir.exists() {
        fs::create_dir_all(&quick_links_dir)
            .map_err(|e| format!("Failed to create quick links directory: {}", e))?;
    }

    let file_path = quick_links_dir.join(format!("{}.json", quick_link.id));
    let json_string = serde_json::to_string_pretty(&quick_link)
        .map_err(|e| format!("Failed to serialize quick link: {}", e))?;

    fs::write(&file_path, json_string)
        .map_err(|e| format!("Failed to write quick link file: {}", e))?;

    Ok(())
}

// Delete a quick link from disk
pub fn delete_quick_link_from_disk(
    app_handle: &AppHandle,
    quick_link_id: &str,
) -> Result<(), String> {
    let quick_links_dir = get_quick_links_dir(app_handle)?;
    let file_path = quick_links_dir.join(format!("{}.json", quick_link_id));

    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete quick link file: {}", e))?;
    }

    Ok(())
}

// Update quick link usage metrics
pub async fn update_quick_link_usage(
    app_handle: &AppHandle,
    quick_link_state: &tauri::State<'_, QuickLinkState>,
    quick_link_id: &str,
) -> Result<(), String> {
    // Lock the state to get mutable access
    let mut quick_links = quick_link_state
        .quick_links
        .lock()
        .map_err(|_| "Failed to lock quick_links state".to_string())?;

    if let Some(quick_link) = quick_links.get_mut(quick_link_id) {
        // Update metrics
        quick_link.last_used = Some(chrono::Utc::now().timestamp());
        quick_link.use_count += 1;

        // Save to disk
        let quick_links_dir = get_quick_links_dir(app_handle)?;
        let file_path = quick_links_dir.join(format!("{}.json", quick_link_id));
        let json_string = serde_json::to_string_pretty(&quick_link)
            .map_err(|e| format!("Failed to serialize quick link: {}", e))?;

        fs::write(&file_path, json_string)
            .map_err(|e| format!("Failed to update quick link file: {}", e))?;
    }

    Ok(())
}