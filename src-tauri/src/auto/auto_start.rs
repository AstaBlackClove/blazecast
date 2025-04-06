#[cfg(target_os = "windows")]
pub fn enable_autostart() {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = "Software\\Microsoft\\Windows\\Currentversion\\Run";

    match hkcu.open_subkey_with_flags(path, KEY_ALL_ACCESS) {
        Ok(key) => {
            let current_exe = std::env::current_exe().unwrap();
            let current_exe_path = current_exe.display().to_string();

            if let Err(e) = key.set_value("BlazeCast", &current_exe_path) {
                eprintln!("Error setting register value: {:?}", e);
            }
        }
        Err(e) => {
            eprintln!("Error opening registry key: {:?}", e);
        }
    }
}
