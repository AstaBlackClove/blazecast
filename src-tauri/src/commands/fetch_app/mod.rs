pub mod app_index;
pub mod app_registry;
pub mod categorization;
pub mod commands;
pub mod icons;
pub mod models;

// Re-export functions that are used in main.rs
pub use app_index::init_app_index;
pub use commands::{get_index_status, get_recent_apps, hide_window, open_app, search_apps,refresh_app_index, add_manual_application};