use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::api::shell;
use tauri::{command, AppHandle, Manager, State};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct NewQuickLinkInput {
    name: String,
    command: String,
    icon: String,
    open_with: OpenWith,
    description: Option<String>,
}

// Type definitions for Quick Links
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuickLink {
    id: String,
    name: String,
    command: String,
    icon: String,
    open_with: OpenWith,
    description: Option<String>,
    last_used: Option<i64>,
    use_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum OpenWith {
    Terminal,
    Browser,
    App,
}

// App state to store quick links in memory
pub struct QuickLinkState {
    pub quick_links: Mutex<HashMap<String, QuickLink>>,
}

impl QuickLinkState {
    pub fn new() -> Self {
        Self {
            quick_links: Mutex::new(HashMap::new()),
        }
    }

    // Load all quick links from disk
    pub fn load_quick_links(&mut self, app_handle: &AppHandle) -> Result<(), String> {
        let quick_links_dir = get_quick_links_dir(app_handle)?;

        if !quick_links_dir.exists() {
            fs::create_dir_all(&quick_links_dir)
                .map_err(|e| format!("Failed to create quick links directory: {}", e))?;
            return Ok(());
        }

        let entries = fs::read_dir(&quick_links_dir)
            .map_err(|e| format!("Failed to read quick links directory: {}", e))?;

        // Get mutable access to the HashMap through the Mutex
        let mut quick_links = self
            .quick_links
            .lock()
            .map_err(|_| "Failed to lock quick_links state".to_string())?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.extension().unwrap_or_default() == "json" {
                    match fs::read_to_string(&path) {
                        Ok(content) => match serde_json::from_str::<QuickLink>(&content) {
                            Ok(quick_link) => {
                                quick_links.insert(quick_link.id.clone(), quick_link);
                            }
                            Err(e) => {
                                eprintln!(
                                    "Failed to parse quick link file {}: {}",
                                    path.display(),
                                    e
                                );
                            }
                        },
                        Err(e) => {
                            eprintln!("Failed to read quick link file {}: {}", path.display(), e);
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

// Helper function to get quick links directory
fn get_quick_links_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "Failed to get app data directory".to_string())?;

    let quick_links_dir = app_dir.join("quick_links");
    Ok(quick_links_dir)
}

// Command to save a quick link
#[command]
pub async fn save_quick_link(
    app_handle: AppHandle,
    quick_link_state: State<'_, QuickLinkState>,
    quick_link: serde_json::Value,
) -> Result<String, String> {
    let quick_link_input: NewQuickLinkInput = serde_json::from_value(quick_link)
        .map_err(|e| format!("Invalid quick link input data: {}", e))?;

    // Now manually build a full QuickLink
    let new_quick_link = QuickLink {
        id: Uuid::new_v4().to_string(),
        name: quick_link_input.name,
        command: quick_link_input.command,
        icon: quick_link_input.icon,
        open_with: quick_link_input.open_with,
        description: quick_link_input.description,
        last_used: None,
        use_count: 0,
    };

    // Save to disk
    let quick_links_dir = get_quick_links_dir(&app_handle)?;
    if !quick_links_dir.exists() {
        fs::create_dir_all(&quick_links_dir)
            .map_err(|e| format!("Failed to create quick links directory: {}", e))?;
    }

    let file_path = quick_links_dir.join(format!("{}.json", new_quick_link.id));
    let json_string = serde_json::to_string_pretty(&new_quick_link)
        .map_err(|e| format!("Failed to serialize quick link: {}", e))?;

    fs::write(&file_path, json_string)
        .map_err(|e| format!("Failed to write quick link file: {}", e))?;

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
    let quick_links_dir = get_quick_links_dir(&app_handle)?;
    let file_path = quick_links_dir.join(format!("{}.json", quick_link_id));

    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete quick link file: {}", e))?;
    }

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

// Helper function to execute a command based on open_with setting
async fn execute_command(app_handle: &AppHandle, quick_link: &QuickLink) -> Result<(), String> {
    match quick_link.open_with {
        OpenWith::Browser => {
            shell::open(&app_handle.shell_scope(), &quick_link.command, None)
                .map_err(|e| format!("Failed to open URL in browser: {}", e))?;
        }
        OpenWith::Terminal => {
            // Implementation depends on your OS and requirements
            #[cfg(target_os = "windows")]
            {
                let home_dir =
                    dirs::home_dir().ok_or_else(|| "Failed to find home directory".to_string())?;

                let command_to_run =
                    format!("echo {} && {}", quick_link.command, quick_link.command);

                std::process::Command::new("cmd")
                    .current_dir(home_dir)
                    .args(&["/C", "start", "cmd", "/K", &command_to_run])
                    .spawn()
                    .map_err(|e| format!("Failed to execute in terminal: {}", e))?;
            }
        }
        OpenWith::App => {
            // Open in default application
            shell::open(&app_handle.shell_scope(), &quick_link.command, None)
                .map_err(|e| format!("Failed to open with default app: {}", e))?;
        }
    }

    Ok(())
}

// Helper function to update quick link usage metrics
async fn update_quick_link_usage(
    app_handle: &AppHandle,
    quick_link_state: &State<'_, QuickLinkState>,
    quick_link_id: &str,
) -> Result<(), String> {
    // Lock the state to get mutable access
    let mut quick_links = quick_link_state
        .quick_links
        .lock()
        .map_err(|_| "Failed to lock quick_links state".to_string())?;

    if let Some(quick_link) = quick_links.get_mut(quick_link_id) {
        // Update metrics
        quick_link.last_used = Some(Utc::now().timestamp());
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
// Initialize the quick link state
pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle();
    let mut quick_link_state = QuickLinkState::new();
    quick_link_state.load_quick_links(&app_handle)?;

    app.manage(quick_link_state);
    Ok(())
}
