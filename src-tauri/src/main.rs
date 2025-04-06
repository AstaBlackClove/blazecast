// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::GlobalShortcutManager;
use tauri::Manager;
mod commands;
use commands::fetch_app::{
    get_index_status, get_recent_apps, init_app_index, open_app,
    search_apps,
};

fn main() {
    let tray_menu = tauri::SystemTrayMenu::new()
        .add_item(tauri::CustomMenuItem::new("show", "Show"))
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(tauri::CustomMenuItem::new("quit", "Quit"));
    let system_tray = tauri::SystemTray::new().with_menu(tray_menu);

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
            get_index_status
        ])
        .setup(|app| {
            // Initialize app index state
            let app_index_state = init_app_index();

            // Make the app index state available to all commands
            app.manage(app_index_state);

            // Schedule periodic index updates
            // let app_index = app.state::<AppIndexState>().index.clone();
            // schedule_index_updates(app_index);

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
