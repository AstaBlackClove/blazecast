use crate::commands::quick_link::{commands::get_vscode_path, models::QuickLink};
use std::path::Path;
use tauri::{api::shell, AppHandle, Manager};

// Enhanced executor that handles more open options
pub async fn execute_command(app_handle: &AppHandle, quick_link: &QuickLink) -> Result<(), String> {
    match quick_link.open_with.as_str() {
        "browser" => {
            shell::open(&app_handle.shell_scope(), &quick_link.command, None)
                .map_err(|e| format!("Failed to open URL in browser: {}", e))?;
        }
        "terminal" => {
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
        "explorer" => {
            #[cfg(target_os = "windows")]
            {
                // Open folder in Windows Explorer
                let path = Path::new(&quick_link.command);
                if path.exists() && path.is_dir() {
                    std::process::Command::new("explorer")
                        .arg(&quick_link.command)
                        .spawn()
                        .map_err(|e| format!("Failed to open in Windows Explorer: {}", e))?;
                } else {
                    // Try to open it anyway
                    std::process::Command::new("explorer")
                        .arg(&quick_link.command)
                        .spawn()
                        .map_err(|e| format!("Failed to open in Windows Explorer: {}", e))?;
                }
            }
        }
        "vscode" => {
            #[cfg(target_os = "windows")]
            {
                if let Some(vscode_path) = get_vscode_path() {
                    std::process::Command::new(vscode_path)
                        .arg(&quick_link.command)
                        .spawn()
                        .map_err(|e| format!("Failed to open in VS Code: {}", e))?;
                } else {
                    return Err(
                        "VS Code not found. Ensure it's installed and the path is correct."
                            .to_string(),
                    );
                }
            }
        }
        "app" | _ => {
            // Open with default application or fallback
            shell::open(&app_handle.shell_scope(), &quick_link.command, None)
                .map_err(|e| format!("Failed to open with default app: {}", e))?;
        }
    }

    Ok(())
}
