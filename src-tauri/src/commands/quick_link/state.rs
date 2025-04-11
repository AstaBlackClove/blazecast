use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::commands::quick_link::models::QuickLink;
use crate::commands::quick_link::storage::get_quick_links_dir;

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
            std::fs::create_dir_all(&quick_links_dir)
                .map_err(|e| format!("Failed to create quick links directory: {}", e))?;
            return Ok(());
        }

        let entries = std::fs::read_dir(&quick_links_dir)
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
                    match std::fs::read_to_string(&path) {
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

// Initialize the quick link state
pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle();
    let mut quick_link_state = QuickLinkState::new();
    quick_link_state.load_quick_links(&app_handle)?;

    app.manage(quick_link_state);
    Ok(())
}