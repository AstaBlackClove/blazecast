#[tauri::command]
pub fn get_clipboard(_window: tauri::Window) -> Result<String, String> {
    // Use a synchronous command instead of async for clipboard operations
    match arboard::Clipboard::new() {
        Ok(mut clipboard) => {
            match clipboard.get_text() {
                Ok(text) => Ok(text),
                Err(e) => Err(format!("Failed to get clipboard text: {}", e))
            }
        },
        Err(e) => Err(format!("Failed to create clipboard: {}", e))
    }
}