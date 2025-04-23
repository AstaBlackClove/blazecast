// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use commands::fetch_app::models::AppIndex;
use commands::fetch_app::models::AppIndexState;
use tauri::GlobalShortcutManager;
use tauri::Manager;
mod auto;
use std::sync::{Arc, Mutex};
mod commands;
use auto::auto_start::{disable_autostart, enable_autostart};
use commands::clip_board::{
    clear_system_clipboard, delete_from_clipboard, get_clipboard, load_clipboard_history,
    pin_clipboard_item, save_clipboard_history, set_clipboard,
};
use commands::fetch_app::{
    add_manual_application, get_index_status, get_recent_apps, hide_window, init_app_index,
    open_app, refresh_app_index, search_apps,
};
use commands::quick_link::{
    check_vscode_path, delete_quick_link, execute_quick_link, execute_quick_link_with_command,
    get_default_browser, get_open_with_suggestions, get_quick_links, get_recent_quick_links,
    save_quick_link, search_quick_links,
};
use commands::window_resize::resize_window;

fn schedule_index_updates(app_index_state: Arc<Mutex<AppIndex>>) {
    std::thread::spawn(move || {
        loop {
            // Sleep for 6 hours before refreshing (adjust as needed)
            std::thread::sleep(std::time::Duration::from_secs(6 * 60 * 60));

            // Create temporary AppIndexState for refresh
            let temp_state = AppIndexState {
                index: app_index_state.clone(),
            };
            // Refresh the index
            commands::fetch_app::app_index::refresh_app_index(&temp_state);
        }
    });
}

pub fn show_window_clipboard_mode(window: tauri::Window) {
    window.show().unwrap();
    window.set_focus().unwrap();
    // We'll send an event to the frontend to switch to clipboard mode
    window.emit("switch-to-clipboard", {}).unwrap();
}

fn main() {
    let tray_menu = tauri::SystemTrayMenu::new()
        .add_item(tauri::CustomMenuItem::new("show", "Show"))
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(tauri::CustomMenuItem::new("quit", "Quit"));
    let system_tray = tauri::SystemTray::new().with_menu(tray_menu);

    // Check for uninstall flag first
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == "--uninstall") {
        disable_autostart();
        return;
    }

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            tauri::SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "show" => {
                    let window = app.get_window("main").unwrap();
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            search_apps,
            get_recent_apps,
            open_app,
            get_index_status,
            hide_window,
            get_clipboard,
            set_clipboard,
            load_clipboard_history,
            save_clipboard_history,
            resize_window,
            clear_system_clipboard,
            delete_from_clipboard,
            pin_clipboard_item,
            get_quick_links,
            search_quick_links,
            get_recent_quick_links,
            save_quick_link,
            execute_quick_link,
            execute_quick_link_with_command,
            delete_quick_link,
            get_open_with_suggestions,
            check_vscode_path,
            get_default_browser,
            refresh_app_index,
            add_manual_application
        ])
        .setup(|app| {
            // Initialize quick links
            commands::quick_link::init(app)?;
            // Initialize app index state
            let app_index_state = init_app_index();

            // Make the app index state available to all commands
            app.manage(app_index_state);

            // Schedule periodic index updates
            let app_index = app.state::<AppIndexState>().index.clone();
            schedule_index_updates(app_index);

            // Register global shortcut (Alt+Space by default)
            let app_handle = app.handle();
            app_handle
                .global_shortcut_manager()
                .register("Alt+Space", move || {
                    let window = app_handle.get_window("main").unwrap();
                    if window.is_visible().unwrap() {
                        window.hide().unwrap();
                    } else {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                })
                .unwrap();

            // Register new global shortcut for clipboard mode (Alt+Shift+C)
            let clipboard_app_handle = app.handle();
            clipboard_app_handle
                .global_shortcut_manager()
                .register("Alt+Shift+C", move || {
                    let window = clipboard_app_handle.get_window("main").unwrap();

                    // Show window and notify frontend to switch to clipboard mode
                    window.show().unwrap();
                    window.set_focus().unwrap();
                    window.emit("switch-to-clipboard", {}).unwrap();
                })
                .unwrap();

            // Enable auto-start during setup
            enable_autostart();

            // Hide dock icon on macOS
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            Ok(())
        })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                event.window().hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
