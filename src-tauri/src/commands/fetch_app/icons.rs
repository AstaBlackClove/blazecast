use std::path::Path;

// Extract icon placeholder - will be replaced with actual icon extraction later
pub fn extract_icon(path: &str) -> String {
    // Create a simple icon identifier based on file extension
    let extension = Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("exe")
        .to_lowercase();

    // Return different identifiers based on common file types
    // This can be extended later to actually extract icons from executables
    match extension.as_str() {
        "exe" => {
            // For executables, create a unique identifier based on path
            let hash = path
                .bytes()
                .fold(0u64, |acc, byte| acc.wrapping_add(byte as u64));
            format!("app-icon:{}", hash)
        }
        _ => "default-icon".to_string(),
    }
}