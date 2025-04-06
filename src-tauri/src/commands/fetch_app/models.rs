use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon: String,
    pub category: String,
    pub last_accessed: Option<u64>,
    pub access_count: u32,
}

#[derive(Default, Serialize, Deserialize)]
pub struct AppIndex {
    pub apps: HashMap<String, AppInfo>,
    pub last_update: u64,
}

pub struct AppIndexState {
    pub index: Arc<Mutex<AppIndex>>,
}