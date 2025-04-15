use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use uuid::Uuid;
use winreg::enums::*;
use winreg::RegKey;

use crate::commands::fetch_app::{
    categorization::categorize_app, icons::extract_icon, models::AppInfo,
};

// Read installed apps from Windows registry
pub fn read_installed_apps() -> Result<HashMap<String, AppInfo>, String> {
    let mut apps = HashMap::new();
    let mut seen_paths = HashSet::new();

    // Scan registry for installed applications
    scan_registry_apps(&mut apps, &mut seen_paths)?;

    // Scan additional drives for common application directories
    scan_additional_drives(&mut apps, &mut seen_paths)?;

    Ok(apps)
}

// Scan registry for installed applications
fn scan_registry_apps(
    apps: &mut HashMap<String, AppInfo>,
    seen_paths: &mut HashSet<String>,
) -> Result<(), String> {
    // Open the uninstall registry key
    let uninstall_key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall")
        .map_err(|e| format!("Failed to open uninstall registry key: {}", e))?;

    // Iterate through all subkeys (installed programs)
    for i in 0..uninstall_key.enum_keys().count() {
        if let Ok(subkey_name) = uninstall_key.enum_keys().nth(i).unwrap() {
            if let Ok(subkey) = uninstall_key.open_subkey(&subkey_name) {
                process_registry_app(&subkey, apps, seen_paths)?;
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
                    process_registry_app(&subkey, apps, seen_paths)?;
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
                    process_registry_app(&subkey, apps, seen_paths)?;
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

                            // Skip Visual C++ Redistributable entries
                            if should_skip_app(&name, &path) {
                                continue;
                            }

                            let id = Uuid::new_v4().to_string();
                            let category = categorize_app(&path, &name);
                            let icon = extract_icon(&path);

                            apps.insert(
                                id.clone(),
                                AppInfo {
                                    id,
                                    name,
                                    path: path.clone(),
                                    icon,
                                    category,
                                    last_accessed: None,
                                    access_count: 0,
                                },
                            );

                            seen_paths.insert(path);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

// Scan additional drives for common application directories
fn scan_additional_drives(
    apps: &mut HashMap<String, AppInfo>,
    seen_paths: &mut HashSet<String>,
) -> Result<(), String> {
    // Get available drives
    let available_drives = get_available_drives()?;

    // Common application directories to check on each drive
    let common_app_dirs = vec![
        "Program Files",
        "Program Files (x86)",
        "Games",
        "Steam",
        "Epic Games",
        "SteamLibrary",
        "Steam Library",
        "Epic Games Library",
        "GOG Games",
        "Ubisoft",
        "Origin Games",
        "EA Games",
        "Riot Games",
        "Battle.net",
        "Blizzard",
    ];

    // Common game launchers to specifically look for
    let common_launchers = HashMap::from([
        ("steam", "Steam"),
        ("epicgameslauncher", "Epic Games Launcher"),
        ("galaxyclient", "GOG Galaxy"),
        ("origin", "Origin"),
        ("battlenet", "Battle.net"),
        ("riot client", "Riot Client"),
        ("ubisoft connect", "Ubisoft Connect"),
    ]);

    for drive in available_drives {
        // Check common application directories
        for app_dir in &common_app_dirs {
            let dir_path = format!("{}\\{}", drive, app_dir);
            let dir = Path::new(&dir_path);

            if dir.exists() && dir.is_dir() {
                scan_directory_for_apps(dir, apps, seen_paths, 2); // Limit recursion depth
            }
        }

        // Check for common game launchers at the root
        for (launcher_exe, launcher_name) in common_launchers.iter() {
            // Try direct path first (like D:\Steam\steam.exe)
            let mut possible_launcher_dirs = vec![format!("{}\\{}", drive, launcher_exe)];

            // Then try subdirectories with the launcher name
            if let Ok(entries) = fs::read_dir(Path::new(&drive)) {
                for entry in entries.filter_map(Result::ok) {
                    if entry.path().is_dir() {
                        if let Some(dir_name) = entry.path().file_name() {
                            if let Some(dir_str) = dir_name.to_str() {
                                if dir_str.to_lowercase().contains(launcher_exe) {
                                    possible_launcher_dirs
                                        .push(entry.path().to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }

            // Check all possible launcher directories
            for launcher_dir in possible_launcher_dirs {
                let launcher_path = format!("{}\\{}.exe", launcher_dir, launcher_exe);
                if Path::new(&launcher_path).exists() {
                    let id = Uuid::new_v4().to_string();
                    let category = categorize_app(&launcher_path, launcher_name);
                    let icon = extract_icon(&launcher_path);

                    if !seen_paths.contains(&launcher_path) {
                        apps.insert(
                            id.clone(),
                            AppInfo {
                                id,
                                name: launcher_name.to_string(),
                                path: launcher_path.clone(),
                                icon,
                                category,
                                last_accessed: None,
                                access_count: 0,
                            },
                        );

                        seen_paths.insert(launcher_path);
                    }
                }
            }
        }
    }

    Ok(())
}

// Recursive function to scan directories for executable files
fn scan_directory_for_apps(
    dir: &Path,
    apps: &mut HashMap<String, AppInfo>,
    seen_paths: &mut HashSet<String>,
    depth: u8,
) {
    // Stop recursion if we've reached the max depth
    if depth == 0 {
        return;
    }

    // Avoid scanning system directories
    let dir_name = dir.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if dir_name.to_lowercase() == "windows"
        || dir_name.to_lowercase() == "system32"
        || dir_name.to_lowercase() == "syswow64"
    {
        return;
    }

    // List of executables to avoid
    let avoid_executables = vec![
        "uninstall.exe",
        "uninst.exe",
        "unins000.exe",
        "setup.exe",
        "installer.exe",
        "repair.exe",
        "update.exe",
        "updater.exe",
    ];

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();

            // Check if it's an executable
            if path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("exe") {
                // Skip uninstaller and setup executables
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if avoid_executables
                        .iter()
                        .any(|&bad_exe| file_name.to_lowercase() == bad_exe)
                    {
                        continue;
                    }

                    // Get a reasonable app name from the file name
                    let app_name = file_name
                        .trim_end_matches(".exe")
                        .split('_')
                        .next()
                        .unwrap_or(file_name.trim_end_matches(".exe"))
                        .to_string();

                    // Skip if we've already seen this path
                    let path_str = path.to_string_lossy().to_string();
                    if seen_paths.contains(&path_str) {
                        continue;
                    }

                    // Skip system tools and redistributables
                    if should_skip_app(&app_name, &path_str) {
                        continue;
                    }

                    let id = Uuid::new_v4().to_string();
                    let category = categorize_app(&path_str, &app_name);
                    let icon = extract_icon(&path_str);

                    // Add to our list of applications
                    apps.insert(
                        id.clone(),
                        AppInfo {
                            id,
                            name: app_name,
                            path: path_str.clone(),
                            icon,
                            category,
                            last_accessed: None,
                            access_count: 0,
                        },
                    );

                    seen_paths.insert(path_str);
                }
            }
            // Recursively check subdirectories
            else if path.is_dir() {
                scan_directory_for_apps(&path, apps, seen_paths, depth - 1);
            }
        }
    }
}

// Get available drives on the system
fn get_available_drives() -> Result<Vec<String>, String> {
    let mut drives = Vec::new();

    // Windows drives typically start from C:
    for drive_letter in b'C'..=b'Z' {
        let drive = format!("{}:", char::from(drive_letter));
        let drive_path = format!("{}\\", drive);

        if Path::new(&drive_path).exists() {
            drives.push(drive);
        }
    }

    Ok(drives)
}

// Helper function to determine if an app should be skipped
fn should_skip_app(name: &str, path: &str) -> bool {
    let name_lower = name.to_lowercase();
    let path_lower = path.to_lowercase();

    // Filter out Visual C++ Redistributable entries
    if name_lower.contains("redistributable")
        || name_lower.contains("vcredist")
        || path_lower.contains("vcredist")
        || (name_lower.contains("visual c++") && name_lower.contains("20"))
    {
        return true;
    }

    // Keep Visual Studio Code specifically
    if name_lower.contains("visual studio code")
        || name_lower == "code"
        || path_lower.contains("vscode")
    {
        return false;
    }

    // Additional system updates and other non-application entries to filter
    name_lower.contains("update for")
        || name_lower.contains("security update")
        || name_lower.contains("hotfix")
        || name_lower.contains("runtime")
        || name_lower.contains("microsoft visual c++")
        || name_lower.contains("microsoft .net")
        || name_lower.contains("directx")
        || path_lower.contains("\\windows\\")
        || path_lower.contains("\\system32\\")
        || path_lower.contains("\\syswow64\\")
}

// Process a single registry app entry
pub fn process_registry_app(
    subkey: &RegKey,
    apps: &mut HashMap<String, AppInfo>,
    seen_paths: &mut HashSet<String>,
) -> Result<(), String> {
    // Skip entries without a DisplayName
    let name: String = match subkey.get_value("DisplayName") {
        Ok(name) => name,
        Err(_) => return Ok(()),
    };

    // Skip redistributables and system updates
    if should_skip_app(&name, "") {
        return Ok(());
    }

    // Get install location or executable path
    let path: Option<String> = subkey.get_value("InstallLocation").ok();
    let display_icon: Option<String> = subkey.get_value("DisplayIcon").ok();
    let uninstall_string: Option<String> = subkey.get_value("UninstallString").ok();

    // List of executables to avoid
    let avoid_executables = vec![
        "uninstall.exe",
        "uninst.exe",
        "unins000.exe",
        "setup.exe",
        "installer.exe",
        "repair.exe",
        "update.exe",
        "updater.exe",
    ];

    // Combine information to get the most accurate path
    let mut app_path = String::new();

    // Try DisplayIcon first (often contains the path to the main executable)
    if let Some(icon_path) = display_icon {
        let icon_path = icon_path.split(',').next().unwrap_or("").trim();
        if icon_path.to_lowercase().ends_with(".exe") && Path::new(icon_path).exists() {
            let file_name = Path::new(icon_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");

            // Skip uninstaller and setup executables
            if !avoid_executables
                .iter()
                .any(|bad_exe| file_name.to_lowercase() == *bad_exe)
            {
                app_path = icon_path.to_string();
            }
        }
    }

// If DisplayIcon didn't work, try UninstallString to at least get the directory
if app_path.is_empty() {
    if let Some(uninstall_path) = uninstall_string {
        let uninstall_path = uninstall_path.split('"').nth(1).unwrap_or(&uninstall_path);
        if Path::new(uninstall_path).exists() {
            let parent_dir = Path::new(uninstall_path).parent();
            if let Some(parent) = parent_dir {
                // Look for executables with the same name as the app
                let name_lower = name.to_lowercase();
                if let Ok(entries) = fs::read_dir(parent) {
                    for entry in entries.filter_map(Result::ok) {
                        let entry_path = entry.path();
                        if entry_path.extension().and_then(|ext| ext.to_str()) == Some("exe") {
                            let file_name = entry_path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("");
                            let file_name_lower = file_name.to_lowercase();

                            // Skip uninstaller executables
                            if avoid_executables
                                .iter()
                                .any(|bad_exe| file_name_lower == *bad_exe)
                            {
                                continue;
                            }

                            // Look for executables with names similar to the app name
                            if file_name_lower.contains(&name_lower)
                                || name_lower.contains(&file_name_lower.trim_end_matches(".exe"))
                            {
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

    // If still empty, try to find the main .exe in the install location
    if app_path.is_empty() {
        if let Some(install_path) = path {
            if !install_path.is_empty() {
                let install_dir = Path::new(&install_path);
                if install_dir.exists() {
                    // Look for .exe files in the install directory
                    if let Ok(entries) = fs::read_dir(install_dir) {
                        // First, try to find the main executable
                        for entry in entries.filter_map(Result::ok) {
                            let entry_path = entry.path();
                            if entry_path.extension().and_then(|ext| ext.to_str()) == Some("exe") {
                                if let Some(file_name) =
                                    entry_path.file_name().and_then(|n| n.to_str())
                                {
                                    // Skip uninstaller and setup executables
                                    if avoid_executables
                                        .iter()
                                        .any(|bad_exe| file_name.to_lowercase() == *bad_exe)
                                    {
                                        continue;
                                    }

                                    // Prioritize executables with names similar to the app name
                                    let file_name_lower = file_name.to_lowercase();
                                    let name_lower = name.to_lowercase();

                                    if file_name_lower.contains(&name_lower)
                                        || name_lower
                                            .contains(&file_name_lower.trim_end_matches(".exe"))
                                    {
                                        app_path = entry_path.to_string_lossy().to_string();
                                        break;
                                    }
                                }
                            }
                        }

                        // If no matching .exe found, just use the first .exe that's not an uninstaller
                        if app_path.is_empty() {
                            if let Ok(entries) = fs::read_dir(install_dir) {
                                for entry in entries.filter_map(Result::ok) {
                                    let entry_path = entry.path();
                                    if entry_path.extension().and_then(|ext| ext.to_str())
                                        == Some("exe")
                                    {
                                        let file_name = entry_path
                                            .file_name()
                                            .and_then(|n| n.to_str())
                                            .unwrap_or("");
                                        if !avoid_executables
                                            .iter()
                                            .any(|bad_exe| file_name.to_lowercase() == *bad_exe)
                                        {
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
    }

    // Skip if we couldn't find a valid executable path
    if app_path.is_empty() || !Path::new(&app_path).exists() {
        return Ok(());
    }

    // Specific handling for known applications
    if name.to_lowercase() == "steam" && app_path.to_lowercase().ends_with("uninstall.exe") {
        // Try to find the actual Steam.exe
        let install_dir = Path::new(&app_path).parent().unwrap_or(Path::new(""));
        let potential_steam_exe = install_dir.join("steam.exe");

        if potential_steam_exe.exists() {
            app_path = potential_steam_exe.to_string_lossy().to_string();
        }
    }

    // Skip if this path was already processed
    if seen_paths.contains(&app_path) {
        return Ok(());
    }

    // Final check to make sure we're not including an uninstaller
    let file_name = Path::new(&app_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if avoid_executables
        .iter()
        .any(|bad_exe| file_name.to_lowercase() == *bad_exe)
    {
        return Ok(());
    }

    let id = Uuid::new_v4().to_string();
    let category = categorize_app(&app_path, &name);
    let icon = extract_icon(&app_path);

    apps.insert(
        id.clone(),
        AppInfo {
            id,
            name,
            path: app_path.clone(),
            icon,
            category,
            last_accessed: None,
            access_count: 0,
        },
    );

    seen_paths.insert(app_path);

    Ok(())
}
