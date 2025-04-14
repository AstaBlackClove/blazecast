use std::path::Path;
use tauri;
use url::Url;

use super::get_default_browser;

#[derive(Debug, Clone, serde::Serialize)]
pub enum CommandType {
    Url(String),          // For web links
    FilePath(String),     // For file paths
    FolderPath(String),   // For folder paths
    ShellCommand(String), // For terminal commands
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct OpenWithSuggestion {
    id: String,
    name: String,
    icon: String,
    is_default: bool,
}

// Function to detect command type
pub fn detect_command_type(command: &str) -> CommandType {
    // Try to parse as URL
    if let Ok(url) = Url::parse(command) {
        if url.scheme() == "http" || url.scheme() == "https" {
            return CommandType::Url(command.to_string());
        }
    }

    // Check if it looks like a file path
    let path = Path::new(command);
    if path.exists() {
        if path.is_dir() {
            return CommandType::FolderPath(command.to_string());
        } else if path.is_file() {
            return CommandType::FilePath(command.to_string());
        }
    }

    // Windows-specific path detection (even if it doesn't exist yet)
    if cfg!(target_os = "windows") {
        // Check for Windows paths (C:\, etc.)
        if command.len() >= 3
            && command.chars().nth(1) == Some(':')
            && (command.chars().nth(2) == Some('\\') || command.chars().nth(2) == Some('/'))
        {
            // This looks like a Windows path
            let path = Path::new(command);
            if path.extension().is_none() {
                // No extension usually means a folder
                return CommandType::FolderPath(command.to_string());
            } else {
                // Has extension usually means a file
                return CommandType::FilePath(command.to_string());
            }
        }
    }

    // Default to treating it as a shell command
    CommandType::ShellCommand(command.to_string())
}

// Function to get application suggestions based on command type
#[tauri::command]
pub async fn get_open_with_suggestions(command: String) -> Vec<OpenWithSuggestion> {
    let command_type = detect_command_type(&command);
    let mut suggestions = Vec::new();

    match command_type {
        CommandType::Url(_) => {
            // Add browser suggestions
            // Try to get the default browser name
            let browser_name = match get_default_browser().await {
                Ok(name) => format!("{} (Default)", name),
                Err(_) => "Default Browser".to_string(),
            };

            suggestions.push(OpenWithSuggestion {
                id: "browser".to_string(),
                name: browser_name,
                icon: "🌐".to_string(),
                is_default: true,
            });
        }
        CommandType::FolderPath(_) => {
            // Add folder-related suggestions
            suggestions.push(OpenWithSuggestion {
                id: "explorer".to_string(),
                name: "Windows Explorer".to_string(),
                icon: "📁".to_string(),
                is_default: true,
            });

            // Only add VS Code if it's available
            if let Some(_) = crate::commands::quick_link::commands::get_vscode_path() {
                suggestions.push(OpenWithSuggestion {
                    id: "vscode".to_string(),
                    name: "Visual Studio Code".to_string(),
                    icon: "💻".to_string(),
                    is_default: false,
                });
            }
        }
        CommandType::FilePath(_) => {
            // Add file-related suggestions
            suggestions.push(OpenWithSuggestion {
                id: "app".to_string(),
                name: "Default Application".to_string(),
                icon: "📄".to_string(),
                is_default: true,
            });

            // Only add VS Code if it's available
            if let Some(_) = crate::commands::quick_link::commands::get_vscode_path() {
                suggestions.push(OpenWithSuggestion {
                    id: "vscode".to_string(),
                    name: "Visual Studio Code".to_string(),
                    icon: "💻".to_string(),
                    is_default: false,
                });
            }
        }
        CommandType::ShellCommand(_) => {
            // For shell commands
            suggestions.push(OpenWithSuggestion {
                id: "terminal".to_string(),
                name: "Terminal".to_string(),
                icon: "⚡".to_string(),
                is_default: true,
            });
        }
    }

    // Always add terminal as an option for non-terminal commands
    if !matches!(command_type, CommandType::ShellCommand(_)) {
        suggestions.push(OpenWithSuggestion {
            id: "terminal".to_string(),
            name: "Terminal".to_string(),
            icon: "⚡".to_string(),
            is_default: false,
        });
    }

    suggestions
}
