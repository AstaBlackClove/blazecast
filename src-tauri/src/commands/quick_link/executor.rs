use tauri::{api::shell, AppHandle, Manager};

use crate::commands::quick_link::models::{OpenWith, QuickLink};

// Helper function to execute a command based on open_with setting
pub async fn execute_command(app_handle: &AppHandle, quick_link: &QuickLink) -> Result<(), String> {
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
