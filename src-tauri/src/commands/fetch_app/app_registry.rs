use std::collections::HashMap;
use std::env;
use std::fs;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use uuid::Uuid;

// Import necessary items from the windows crate.
use windows::core::{ComInterface, PCWSTR};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED, STGM_READ,
};
// Use WIN32_FIND_DATAW from Storage::FileSystem.
use windows::Win32::Storage::FileSystem::WIN32_FIND_DATAW;
use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

use crate::commands::fetch_app::{
    categorization::categorize_app, icons::extract_icon, models::AppInfo,
};

/// Checks if an application with the same target path already exists in the app collection
fn is_duplicate_app(apps: &HashMap<String, AppInfo>, target_path: &str) -> bool {
    let target_path_lower = target_path.to_lowercase();
    apps.values().any(|app| app.path.to_lowercase() == target_path_lower)
}

fn scan_additional_shortcuts(
    apps: &mut HashMap<String, AppInfo>,
    directory: &Path,
) -> Result<(), String> {
    if directory.exists() && directory.is_dir() {
        for entry in fs::read_dir(directory)
            .map_err(|e| format!("Failed to read directory {}: {}", directory.display(), e))?
            .filter_map(Result::ok)
        {
            let path = entry.path();
            
            // If this is a directory, recursively scan it
            if path.is_dir() {
                scan_additional_shortcuts(apps, &path)?;
                continue;
            }
            
            let is_lnk = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map_or(false, |ext| ext.eq_ignore_ascii_case("lnk"));

            let target_path = if is_lnk {
                parse_shortcut(&path).ok()
            } else if path
                .extension()
                .and_then(|ext| ext.to_str())
                .map_or(false, |ext| ext.eq_ignore_ascii_case("exe"))
            {
                Some(path.to_string_lossy().to_string())
            } else {
                None
            };

            if let Some(target_path) = target_path {
                if target_path.to_lowercase().ends_with(".exe")
                    && Path::new(&target_path).exists()
                {
                    let name = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    if should_skip_app(&name, &target_path) {
                        continue;
                    }
                    
                    // Check if this application is already indexed (by path)
                    if !is_duplicate_app(apps, &target_path) {
                        let id = Uuid::new_v4().to_string();
                        let category = categorize_app(&target_path, &name);
                        let icon = extract_icon(&target_path).unwrap_or_default();
                        apps.insert(
                            id.clone(),
                            AppInfo {
                                id,
                                name,
                                path: target_path,
                                icon,
                                category,
                                last_accessed: None,
                                access_count: 0,
                            },
                        );
                    }
                }
            }
        }
    }
    Ok(())
}

/// Reads installed apps by scanning the current user's Desktop folder for .lnk shortcuts.
pub fn read_installed_apps() -> Result<HashMap<String, AppInfo>, String> {
    let mut apps = HashMap::new();

    // Scan Desktop.
    let user_profile = env::var("USERPROFILE")
        .map_err(|e| format!("USERPROFILE environment variable is not set: {}", e))?;
    let desktop_path = Path::new(&user_profile).join("Desktop");
    scan_additional_shortcuts(&mut apps, &desktop_path)?;

    // Scan Current User's Start Menu Programs.
    if let Ok(appdata) = env::var("APPDATA") {
        let start_menu_path = Path::new(&appdata).join("Microsoft/Windows/Start Menu/Programs");
        scan_additional_shortcuts(&mut apps, &start_menu_path)?;
    }

    // Optionally, scan the All Users Start Menu (this requires administrator privileges for reading some parts).
    let all_users_start_menu = Path::new("C:/ProgramData/Microsoft/Windows/Start Menu/Programs");
    scan_additional_shortcuts(&mut apps, &all_users_start_menu)?;

    // scan_desktop_shortcuts(&mut apps)?;
    Ok(apps)
}

/// Returns `true` if the app should be skipped based on its name or path.
fn should_skip_app(name: &str, path: &str) -> bool {
    let name_lower = name.to_lowercase();
    let path_lower = path.to_lowercase();

    // Explicitly allow Steam even if some of the other keywords match.
    if name_lower.contains("steam") {
        return false;
    }

    // Skip uninstallers
    if name_lower.contains("uninstall")
        || name_lower.contains("remove")
        || name_lower.starts_with("uninst")
        || name_lower.contains("uninstaller")
        || name_lower.contains("_uninstall")
        || path_lower.contains("uninstall")
        || path_lower.contains("\\uninst")
    {
        return true;
    }

    if name_lower.contains("redistributable")
        || name_lower.contains("vcredist")
        || path_lower.contains("vcredist")
        || (name_lower.contains("visual c++") && name_lower.contains("20"))
    {
        return true;
    }

    if name_lower.contains("visual studio code")
        || name_lower == "code"
        || path_lower.contains("vscode")
    {
        return false;
    }

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

/// Parses a .lnk shortcut file using the COM ShellLink API.
fn parse_shortcut(shortcut_path: &Path) -> Result<String, String> {
    unsafe {
        // Initialize COM in a single-threaded apartment.
        CoInitializeEx(Some(std::ptr::null_mut()), COINIT_APARTMENTTHREADED)
            .map_err(|e| format!("COM initialization failed: {:?}", e))?;

        // Create an IShellLink object.
        let shell_link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| format!("Failed to create ShellLink: {:?}", e))?;

        // Query for the IPersistFile interface.
        let persist_file: IPersistFile = shell_link
            .cast()
            .map_err(|e| format!("Failed to cast to IPersistFile: {:?}", e))?;

        // Convert the shortcut path to a wide string.
        let mut shortcut_w: Vec<u16> = shortcut_path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Use the mutable slice from the vector to construct a PCWSTR.
        let shortcut_pcwstr = PCWSTR(shortcut_w.as_mut_ptr());
        persist_file
            .Load(shortcut_pcwstr, STGM_READ)
            .map_err(|e| format!("Failed to load shortcut file: {:?}", e))?;

        // Prepare a buffer to receive the target path.
        let mut target_buffer: [u16; 260] = [0; 260];
        let find_data: *mut WIN32_FIND_DATAW = std::ptr::null_mut();
        // Updated call: now passing a mutable slice and adding the missing flags parameter.
        shell_link
            .GetPath(&mut target_buffer, find_data, 0u32)
            .map_err(|e| format!("Failed to get target path from shortcut: {:?}", e))?;

        // Uninitialize COM.
        CoUninitialize();

        let target = String::from_utf16_lossy(&target_buffer);
        Ok(target.trim_end_matches('\0').to_string())
    }
}
