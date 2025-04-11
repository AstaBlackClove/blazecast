// Re-export modules
mod commands;
mod executor;
mod models;
mod state;
mod storage;

// Public re-exports
pub use commands::{
    delete_quick_link, execute_quick_link, execute_quick_link_with_command, get_quick_links,
    get_recent_quick_links, save_quick_link,
};
pub use state::init;
