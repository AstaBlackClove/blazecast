// Function to categorize applications
pub fn categorize_app(path: &str, name: &str) -> String {
    let path_lower = path.to_lowercase();
    let name_lower = name.to_lowercase();

    // Path-based categorization
    if path_lower.contains("\\steam\\") 
        || path_lower.contains("\\epic games\\")
        || path_lower.contains("\\ubisoft\\")
        || path_lower.contains("\\riot games\\")
    {
        return "Games".to_string();
    }

    if path_lower.contains("\\microsoft office\\") 
        || path_lower.contains("\\libreoffice\\")
        || path_lower.contains("\\openoffice\\")
    {
        return "Office".to_string();
    }

    if path_lower.contains("\\spotify\\")
        || path_lower.contains("\\vlc\\")
        || path_lower.contains("\\winamp\\")
        || path_lower.contains("\\itunes\\")
    {
        return "Media".to_string();
    }

    // Name-based categorization
    let category_from_name = match name_lower.as_str() {
        n if n.contains("browser") || n.contains("chrome") || n.contains("firefox") || n.contains("edge") => "Browsers",
        n if n.contains("word") || n.contains("excel") || n.contains("powerpoint") => "Office",
        n if n.contains("steam") || n.contains("game") => "Games",
        n if n.contains("spotify") || n.contains("player") || n.contains("music") => "Media",
        n if n.contains("discord") || n.contains("chat") || n.contains("message") => "Social",
        n if n.contains("code") || n.contains("studio") || n.contains("dev") => "Development",
        n if n.contains("photo") || n.contains("paint") || n.contains("draw") => "Design",
        n if n.contains("zip") || n.contains("cleaner") || n.contains("tool") => "Utilities",
        _ => "",
    };

    if !category_from_name.is_empty() {
        return category_from_name.to_string();
    }

    // Default category
    "Applications".to_string()
}