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

// New function with required State parameter
#[tauri::command]
pub async fn search_quick_links(
    query: &str,
    quick_link_state: State<'_, QuickLinkState>,
) -> Result<Vec<QuickLink>, String> {
    // Get all quick links using the state parameter
    let quick_links_guard = quick_link_state
        .quick_links
        .lock()
        .map_err(|_| "Failed to lock quick_links state".to_string())?;

    // Convert to Vec and clone for processing
    let all_quick_links: Vec<QuickLink> = quick_links_guard.values().cloned().collect();

    // Case-insensitive filtering
    let query = query.to_lowercase();
    let filtered_links: Vec<QuickLink> = all_quick_links
        .into_iter()
        .filter(|link| {
            link.name.to_lowercase().contains(&query)
                || link
                    .description
                    .as_ref()
                    .map_or(false, |desc| desc.to_lowercase().contains(&query))
                || link.command.to_lowercase().contains(&query)
        })
        .collect();

    // Sort filtered results by last_used date
    let mut sorted_filtered_links = filtered_links;
    sorted_filtered_links.sort_by(|a, b| b.last_used.unwrap_or(0).cmp(&a.last_used.unwrap_or(0)));

    Ok(sorted_filtered_links)
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
    #[cfg(target_os = "windows")]
    {
        use std::path::Path;
        use winreg::enums::*;
        use winreg::RegKey;

        // Common VS Code installation paths to check as fallbacks
        let common_paths = [
            r"C:\Program Files\Microsoft VS Code\Code.exe",
            r"C:\Program Files (x86)\Microsoft VS Code\Code.exe",
            r"%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe",
        ];

        // Check registry first (App Paths) - silently handle registry errors
        let check_reg_key = |root: RegKey, subkey: &str| -> Option<String> {
            // Try to open the registry key - silently return None if fails
            let vscode_key = match root.open_subkey_with_flags(subkey, KEY_READ | KEY_WOW64_64KEY) {
                Ok(key) => key,
                Err(_) => return None, // Silently fail without logging
            };

            // Try to get the value - silently return None if fails
            let path_str: String = match vscode_key.get_value("") {
                Ok(path) => path,
                Err(_) => return None, // Silently fail without logging
            };

            // Split potential arguments and trim quotes
            let trimmed_path = path_str
                .split(' ') // Split on spaces (common for arguments)
                .next()? // Take the first part (the actual path)
                .trim_matches('"')
                .to_string();

            let path = Path::new(&trimmed_path);
            if path.exists() {
                Some(trimmed_path)
            } else {
                None
            }
        };

        // Registry keys to check
        let registry_checks = [
            (
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\Code.exe",
            ),
            (
                HKEY_CURRENT_USER,
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\Code.exe",
            ),
            (
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Classes\Applications\Code.exe\shell\open\command",
            ),
            (HKEY_CLASSES_ROOT, r"vscode\shell\open\command"),
        ];

        // Check all registry locations
        for (hkey, subkey) in registry_checks.iter() {
            if let Some(path) = check_reg_key(RegKey::predef(*hkey), subkey) {
                return Some(path);
            }
        }

        // Try common installation paths as fallback
        for path in common_paths.iter() {
            let expanded_path = if path.contains("%LOCALAPPDATA%") {
                if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
                    path.replace("%LOCALAPPDATA%", local_app_data.to_string_lossy().as_ref())
                } else {
                    continue;
                }
            } else {
                path.to_string()
            };
            let p = Path::new(&expanded_path);
            if p.exists() {
                return Some(expanded_path);
            }
        }

        // Additionally check if VS Code is in PATH
        if let Ok(output) = std::process::Command::new("where").arg("code").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout);
                let path = path.lines().next().unwrap_or("").trim();
                if !path.is_empty() {
                    return Some(path.to_string());
                }
            }
        }
        None
    }
}

#[tauri::command]
pub async fn check_vscode_path() -> Option<String> {
    get_vscode_path()
}

// Get the default browser on Windows
#[tauri::command]
pub async fn get_default_browser() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Try multiple registry paths for better detection
        let registry_checks = [
            r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice",
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.html\UserChoice",
        ];

        for reg_path in registry_checks {
            if let Ok(reg_key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey(reg_path) {
                if let Ok(prog_id) = reg_key.get_value::<String, _>("ProgId") {
                    // Map ProgID to a browser name
                    let browser_name = match prog_id.as_str() {
                        "ChromeHTML" => "Google Chrome",
                        "FirefoxURL" | "Firefox-308046B0AF4A39CB" => "Mozilla Firefox",
                        "MSEdgeHTM" | "AppXq0fevzme2pys62n3e0fbqa7peapykr8v" => "Microsoft Edge",
                        "IE.HTTP" => "Internet Explorer",
                        "OperaStable" => "Opera",
                        "BraveHTML" => "Brave",
                        "SafariHTML" => "Safari",
                        "ChromiumHTM" => "Chromium",
                        "VivaldiHTM" => "Vivaldi",
                        _ => {
                            // Try to extract name from ProgID if it's not in our map
                            if prog_id.contains("Chrome") {
                                "Google Chrome"
                            } else if prog_id.contains("Firefox") {
                                "Mozilla Firefox"
                            } else if prog_id.contains("Edge") {
                                "Microsoft Edge"
                            } else if prog_id.contains("Opera") {
                                "Opera"
                            } else if prog_id.contains("Brave") {
                                "Brave"
                            } else {
                                &prog_id // Fallback to raw ProgID if unknown
                            }
                        }
                    };
                    return Ok(browser_name.to_string());
                }
            }
        }

        // Alternative method using default apps settings
        if let Ok(root) = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\ApplicationAssociationToasts")
        {
            for (name, _) in root.enum_values().filter_map(Result::ok) {
                if name.contains("_http") {
                    let parts: Vec<&str> = name.split('_').collect();
                    if parts.len() > 1 {
                        let app_name = parts[0];

                        // Clean up and format the browser name
                        let browser_name = if app_name.contains("Chrome") {
                            "Google Chrome"
                        } else if app_name.contains("Firefox") {
                            "Mozilla Firefox"
                        } else if app_name.contains("Edge") {
                            "Microsoft Edge"
                        } else if app_name.contains("Opera") {
                            "Opera"
                        } else if app_name.contains("Brave") {
                            "Brave"
                        } else {
                            app_name
                        };

                        return Ok(browser_name.to_string());
                    }
                }
            }
        }
        Ok("Web Browser".to_string())
    }
}
