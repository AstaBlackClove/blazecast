#[tauri::command]
pub fn set_clipboard(text: String, _window: tauri::Window) -> Result<(), String> {
    match arboard::Clipboard::new() {
        Ok(mut clipboard) => {
            match clipboard.set_text(text) {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("Failed to set clipboard text: {}", e))
            }
        },
        Err(e) => Err(format!("Failed to create clipboard: {}", e))
    }
}