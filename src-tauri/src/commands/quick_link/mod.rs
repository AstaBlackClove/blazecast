// Re-export modules
mod command_input;
mod commands;
mod executor;
mod models;
mod state;
mod storage;

// Public re-exports
pub use command_input::get_open_with_suggestions;
pub use commands::{
    check_vscode_path, delete_quick_link, execute_quick_link, execute_quick_link_with_command,
    get_default_browser, get_quick_links, get_recent_quick_links, save_quick_link,
    search_quick_links,
};
pub use state::init;
