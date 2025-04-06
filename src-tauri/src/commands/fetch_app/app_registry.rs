use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use uuid::Uuid;
use winreg::enums::*;
use winreg::RegKey;

use crate::commands::fetch_app::{
    categorization::categorize_app,
    icons::extract_icon,
    models::AppInfo,
};

// Read installed apps from Windows registry
pub fn read_installed_apps() -> Result<HashMap<String, AppInfo>, String> {
    let mut apps = HashMap::new();
    let seen_paths = HashSet::new();

    // Open the uninstall registry key
    let uninstall_key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall")
        .map_err(|e| format!("Failed to open uninstall registry key: {}", e))?;

    // Iterate through all subkeys (installed programs)
    for i in 0..uninstall_key.enum_keys().count() {
        if let Ok(subkey_name) = uninstall_key.enum_keys().nth(i).unwrap() {
            if let Ok(subkey) = uninstall_key.open_subkey(&subkey_name) {
                process_registry_app(&subkey, &mut apps, &seen_paths)?;
            }
        }
    }

    // Also check for 32-bit applications on 64-bit systems
    let wow64_key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey("SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall");
    
    if let Ok(wow64_key) = wow64_key {
        for i in 0..wow64_key.enum_keys().count() {
            if let Ok(subkey_name) = wow64_key.enum_keys().nth(i).unwrap() {
                if let Ok(subkey) = wow64_key.open_subkey(&subkey_name) {
                    process_registry_app(&subkey, &mut apps, &seen_paths)?;
                }
            }
        }
    }

    // Also check current user installed apps
    let current_user_key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall");
    
    if let Ok(current_user_key) = current_user_key {
        for i in 0..current_user_key.enum_keys().count() {
            if let Ok(subkey_name) = current_user_key.enum_keys().nth(i).unwrap() {
                if let Ok(subkey) = current_user_key.open_subkey(&subkey_name) {
                    process_registry_app(&subkey, &mut apps, &seen_paths)?;
                }
            }
        }
    }

    // Check for Microsoft Store apps
    let app_paths_key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths");
    
    if let Ok(app_paths_key) = app_paths_key {
        for i in 0..app_paths_key.enum_keys().count() {
            if let Ok(subkey_name) = app_paths_key.enum_keys().nth(i).unwrap() {
                if let Ok(subkey) = app_paths_key.open_subkey(&subkey_name) {
                    if let Ok(path) = subkey.get_value::<String, _>("") {
                        // Only process if path exists and is an .exe file
                        if path.to_lowercase().ends_with(".exe") && Path::new(&path).exists() {
                            let name = subkey_name.trim_end_matches(".exe").to_string();
                            let id = Uuid::new_v4().to_string();
                            let category = categorize_app(&path, &name);
                            let icon = extract_icon(&path);
                            
                            apps.insert(id.clone(), AppInfo {
                                id,
                                name,
                                path,
                                icon,
                                category,
                                last_accessed: None,
                                access_count: 0,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(apps)
}

// Process a single registry app entry
pub fn process_registry_app(
    subkey: &RegKey, 
    apps: &mut HashMap<String, AppInfo>,
    seen_paths: &HashSet<String>
) -> Result<(), String> {
    // Skip entries without a DisplayName
    let name: String = match subkey.get_value("DisplayName") {
        Ok(name) => name,
        Err(_) => return Ok(()),
    };

    // Skip system updates and other non-application entries
    if name.contains("Update for") || name.contains("Security Update") || name.contains("Hotfix") {
        return Ok(());
    }

    // Get install location or executable path
    let path: Option<String> = subkey.get_value("InstallLocation").ok();
    let display_icon: Option<String> = subkey.get_value("DisplayIcon").ok();
    
    // Combine information to get the most accurate path
    let mut app_path = String::new();
    
    if let Some(icon_path) = display_icon {
        // DisplayIcon often contains the path to the main executable
        let icon_path = icon_path.split(',').next().unwrap_or("").trim();
        if icon_path.to_lowercase().ends_with(".exe") && Path::new(icon_path).exists() {
            app_path = icon_path.to_string();
        }
    }
    
    if app_path.is_empty() {
        // If no icon path with .exe is found, try to find the main .exe in the install location
        if let Some(install_path) = path {
            if !install_path.is_empty() {
                let install_dir = Path::new(&install_path);
                if install_dir.exists() {
                    // Look for .exe files in the install directory
                    if let Ok(entries) = fs::read_dir(install_dir) {
                        for entry in entries.filter_map(Result::ok) {
                            let entry_path = entry.path();
                            if entry_path.extension().and_then(|ext| ext.to_str()) == Some("exe") {
                                if let Some(file_name) = entry_path.file_name().and_then(|n| n.to_str()) {
                                    // Prioritize executables with names similar to the app name
                                    let file_name_lower = file_name.to_lowercase();
                                    let name_lower = name.to_lowercase();
                                    
                                    if file_name_lower.contains(&name_lower) || 
                                       name_lower.contains(&file_name_lower.trim_end_matches(".exe")) {
                                        app_path = entry_path.to_string_lossy().to_string();
                                        break;
                                    }
                                }
                            }
                        }
                        
                        // If no matching .exe found, just use the first .exe
                        if app_path.is_empty() {
                            if let Ok(entries) = fs::read_dir(install_dir) {
                                for entry in entries.filter_map(Result::ok) {
                                    let entry_path = entry.path();
                                    if entry_path.extension().and_then(|ext| ext.to_str()) == Some("exe") {
                                        app_path = entry_path.to_string_lossy().to_string();
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Skip if we couldn't find a valid executable path
    if app_path.is_empty() || !Path::new(&app_path).exists() || seen_paths.contains(&app_path) {
        return Ok(());
    }
    
    let id = Uuid::new_v4().to_string();
    let category = categorize_app(&app_path, &name);
    let icon = extract_icon(&app_path);
    
    apps.insert(id.clone(), AppInfo {
        id,
        name,
        path: app_path,
        icon,
        category,
        last_accessed: None,
        access_count: 0,
    });
    
    Ok(())
}