use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct NewQuickLinkInput {
    pub name: String,
    pub command: String,
    pub icon: String,
    pub open_with: OpenWith,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuickLink {
    pub id: String,
    pub name: String,
    pub command: String,
    pub icon: String,
    pub open_with: OpenWith,
    pub description: Option<String>,
    pub last_used: Option<i64>,
    pub use_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum OpenWith {
    Terminal,
    Browser,
    App,
}