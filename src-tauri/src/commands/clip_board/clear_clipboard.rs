#[tauri::command]
pub fn clear_system_clipboard(_window: tauri::Window) -> Result<(), String> {
    match arboard::Clipboard::new() {
        Ok(mut clipboard) => {
            // Set clipboard to empty string to clear it
            match clipboard.set_text("") {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("Failed to clear clipboard: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to create clipboard: {}", e)),
    }
}

#[tauri::command]
pub fn delete_from_clipboard(
    _window: tauri::Window,
    current_text: String,
    replacement_text: Option<String>,
) -> Result<(), String> {
    match arboard::Clipboard::new() {
        Ok(mut clipboard) => match clipboard.get_text() {
            Ok(text) => {
                if text == current_text {
                    let new_text = replacement_text.unwrap_or_else(|| String::from(""));
                    match clipboard.set_text(new_text) {
                        Ok(_) => Ok(()),
                        Err(e) => Err(format!("Failed to update clipboard: {}", e)),
                    }
                } else {
                    Ok(())
                }
            }
            Err(e) => Err(format!("Failed to get clipboard text: {}", e)),
        },
        Err(e) => Err(format!("Failed to create clipboard: {}", e)),
    }
}
