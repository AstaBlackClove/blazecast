#[tauri::command]
pub fn resize_window(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    // First set the size
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: width as u32,
            height: height as u32,
        }))
        .map_err(|e| e.to_string())?;
    
    // Then center the window
    window.center().map_err(|e| e.to_string())?;
    
    Ok(())
}