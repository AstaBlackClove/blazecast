use crate::commands::quick_link::executor::execute_command;
use crate::commands::quick_link::models::{NewQuickLinkInput, QuickLink};
use crate::commands::quick_link::state::QuickLinkState;
use crate::commands::quick_link::storage::{
    delete_quick_link_from_disk, save_quick_link_to_disk, update_quick_link_usage,
};
use tauri::{command, AppHandle, State};
use uuid::Uuid;
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

use super::models::OpenWith;

// Command to save a quick link
#[command]
pub async fn save_quick_link(
    app_handle: AppHandle,
    quick_link_state: State<'_, QuickLinkState>,
    quick_link: serde_json::Value,
) -> Result<String, String> {
    let quick_link_input: NewQuickLinkInput = serde_json::from_value(quick_link)
        .map_err(|e| format!("Invalid quick link input data: {}", e))?;

    let open_with = match quick_link_input.open_with.as_str() {
        "browser" => OpenWith::Browser,
        "terminal" => OpenWith::Terminal,
        "app" => OpenWith::App,
        "explorer" => OpenWith::Explorer,
        "vscode" => OpenWith::VSCode,
        _ => OpenWith::Browser, // Default to browser
    };
    let open_with_string = open_with.as_str().to_string();
    // Now manually build a full QuickLink
    let new_quick_link = QuickLink {
        id: Uuid::new_v4().to_string(),
        name: quick_link_input.name,
        command: quick_link_input.command,
        icon: quick_link_input.icon,
        open_with: open_with_string,
        description: quick_link_input.description,
        last_used: None,
        use_count: 0,
    };

    // Save to disk
    save_quick_link_to_disk(&app_handle, &new_quick_link)?;

    // Update in-memory state
    let mut quick_links = quick_link_state
        .quick_links
        .lock()
        .map_err(|_| "Failed to lock quick_links state".to_string())?;

    quick_links.insert(new_quick_link.id.clone(), new_quick_link.clone());

    Ok(new_quick_link.id)
}

#[command]
pub async fn delete_quick_link(
    app_handle: AppHandle,
    quick_link_state: State<'_, QuickLinkState>,
    quick_link_id: String,
) -> Result<(), String> {
    // 1. Remove from memory
    let mut quick_links = quick_link_state
        .quick_links
        .lock()
        .map_err(|_| "Failed to lock quick_links state".to_string())?;

    if quick_links.remove(&quick_link_id).is_none() {
        return Err(format!("Quick link not found: {}", quick_link_id));
    }

    // 2. Remove the file from disk
    delete_quick_link_from_disk(&app_handle, &quick_link_id)?;

    Ok(())
}

// Command to get all quick links
#[command]
pub async fn get_quick_links(
    quick_link_state: State<'_, QuickLinkState>,
) -> Result<Vec<QuickLink>, String> {
    let quick_links_guard = quick_link_state
        .quick_links
        .lock()
        .map_err(|_| "Failed to lock quick_links state".to_string())?;

    let mut quick_links: Vec<QuickLink> = quick_links_guard.values().cloned().collect();
    quick_links.sort_by(|a, b| b.last_used.unwrap_or(0).cmp(&a.last_used.unwrap_or(0)));
    Ok(quick_links)
}

// Command to get recent quick links
#[command]
pub async fn get_recent_quick_links(
    quick_link_state: State<'_, QuickLinkState>,
) -> Result<Vec<QuickLink>, String> {
    let quick_links_guard = quick_link_state
        .quick_links
        .lock()
        .map_err(|_| "Failed to lock quick_links state".to_string())?;

    let mut quick_links: Vec<QuickLink> = quick_links_guard.values().cloned().collect();

    // Sort by last used time and use count
    quick_links.sort_by(|a, b| {
        let b_last_used = b.last_used.unwrap_or(0);
        let a_last_used = a.last_used.unwrap_or(0);
        b_last_used
            .cmp(&a_last_used)
            .then_with(|| b.use_count.cmp(&a.use_count))
    });

    // Return top 5 quick links
    Ok(quick_links.into_iter().take(5).collect())
}

// Execute a quick link with only its ID
#[command]
pub async fn execute_quick_link(
    app_handle: AppHandle,
    quick_link_state: State<'_, QuickLinkState>,
    quick_link_id: String,
) -> Result<(), String> {
    // Find the quick link BEFORE await
    let quick_link = {
        let quick_links_guard = quick_link_state
            .quick_links
            .lock()
            .map_err(|_| "Failed to lock quick_links state".to_string())?;

        quick_links_guard
            .get(&quick_link_id)
            .ok_or_else(|| format!("Quick link not found: {}", quick_link_id))?
            .clone()
    };

    // Now after releasing lock, safely await
    execute_command(&app_handle, &quick_link).await?;
    update_quick_link_usage(&app_handle, &quick_link_state, &quick_link_id).await?;

    Ok(())
}

#[command]
pub async fn execute_quick_link_with_command(
    app_handle: AppHandle,
    quick_link_state: State<'_, QuickLinkState>,
    quick_link_id: String,
    command: String,
) -> Result<(), String> {
    // Find and clone the quick link BEFORE await
    let mut quick_link = {
        let quick_links_guard = quick_link_state
            .quick_links
            .lock()
            .map_err(|_| "Failed to lock quick_links state".to_string())?;

        quick_links_guard
            .get(&quick_link_id)
            .ok_or_else(|| format!("Quick link not found: {}", quick_link_id))?
            .clone()
    };

    // Override the command AFTER dropping the lock
    quick_link.command = command;

    // Now after releasing lock, safely await
    execute_command(&app_handle, &quick_link).await?;
    update_quick_link_usage(&app_handle, &quick_link_state, &quick_link_id).await?;

    Ok(())
}

pub fn get_vscode_path() -> Option<String> {
    println!("get vscode triggered");

    use std::path::Path;
    use winreg::enums::*;
    use winreg::RegKey;

    let check_key = |root: RegKey| -> Option<String> {
        // Use KEY_WOW64_64KEY to access 64-bit registry explicitly
        let vscode_key = root
            .open_subkey_with_flags(
                "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Code.exe",
                KEY_READ | KEY_WOW64_64KEY,
            )
            .ok()?;

        let path_str: String = vscode_key.get_value("").ok()?;

        println!("Launching app at path: {}", path_str);

        // Split potential arguments and trim quotes
        let trimmed_path = path_str
            .split(' ') // Split on spaces (common for arguments)
            .next()? // Take the first part (the actual path)
            .trim_matches('"')
            .to_string();

        let path = Path::new(&trimmed_path);
        if path.exists() {
            println!("Found VS Code at: {}", trimmed_path);
            Some(trimmed_path)
        } else {
            println!("Path does not exist: {}", trimmed_path);
            None
        }
    };

    // Check HKLM
    if let Some(path) = check_key(RegKey::predef(HKEY_LOCAL_MACHINE)) {
        return Some(path);
    }

    // Check HKCU
    if let Some(path) = check_key(RegKey::predef(HKEY_CURRENT_USER)) {
        return Some(path);
    }

    None
}

#[tauri::command]
pub async fn check_vscode_path() -> Option<String> {
    get_vscode_path()
}

// Get the default browser on Windows
#[tauri::command]
pub async fn get_default_browser() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        // New Windows registry code
        let reg_key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(
                r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice",
            )
            .ok()?;

        let prog_id: String = reg_key.get_value("ProgId").ok()?;

        // Map ProgID to a browser name (e.g., "ChromeHTML" => "Google Chrome")
        match prog_id.as_str() {
            "ChromeHTML" => Some("Google Chrome".to_string()),
            "FirefoxURL" => Some("Mozilla Firefox".to_string()),
            "MSEdgeHTM" => Some("Microsoft Edge".to_string()),
            "IE.HTTP" => Some("Internet Explorer".to_string()),
            _ => Some(prog_id), // Fallback to raw ProgID if unknown
        }
    }
}
