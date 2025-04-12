use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct NewQuickLinkInput {
    pub name: String,
    pub command: String,
    pub icon: String,
    pub open_with: String,  // Changed from OpenWith enum to String
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuickLink {
    pub id: String,
    pub name: String,
    pub command: String,
    pub icon: String,
    pub open_with: String,
    pub description: Option<String>,
    pub last_used: Option<i64>,
    pub use_count: i32,
}

// Keep the enum for reference, but implement as_str() method
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum OpenWith {
    Terminal,
    Browser,
    App,
    Explorer,
    VSCode, 
}

// Implement the as_str method for OpenWith
impl OpenWith {
    pub fn as_str(&self) -> &str {
        match self {
            OpenWith::Terminal => "terminal",
            OpenWith::Browser => "browser",
            OpenWith::App => "app",
            OpenWith::Explorer => "explorer",
            OpenWith::VSCode => "vscode",
        }
    }
    
    // Add a from_str method for convenience
    // pub fn from_str(s: &str) -> Option<Self> {
    //     match s {
    //         "terminal" => Some(Self::Terminal),
    //         "browser" => Some(Self::Browser),
    //         "app" => Some(Self::App),
    //         "explorer" => Some(Self::Explorer),
    //         "vscode" => Some(Self::VSCode),
    //         _ => None,
    //     }
    // }
}