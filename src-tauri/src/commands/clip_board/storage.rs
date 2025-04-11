// storage.rs - Updated version
use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce}; // Note: KeyInit instead of NewAead
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf; // Updated base64 usage

#[derive(Serialize, Deserialize)]
pub struct ClipboardHistoryFile {
    items: Vec<ClipboardItem>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ClipboardItem {
    pub id: u64,
    pub text: String,
    pub timestamp: u64,
    pub pinned: bool,
    pub last_copied: u64,
    pub copy_count: u64,
}

// Get the path to the clipboard history file
fn get_history_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "Failed to get app data directory".to_string())?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join("clipboard_history.encrypted"))
}

// Generate or retrieve encryption key
fn get_encryption_key(app_handle: &tauri::AppHandle) -> Result<[u8; 32], String> {
    let key_file_path = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "Failed to get app data directory".to_string())?
        .join("encryption_key.bin");

    if key_file_path.exists() {
        // Read existing key
        let key_data = fs::read(&key_file_path)
            .map_err(|e| format!("Failed to read encryption key: {}", e))?;

        if key_data.len() != 32 {
            return Err("Invalid encryption key".to_string());
        }

        let mut key = [0u8; 32];
        key.copy_from_slice(&key_data);
        Ok(key)
    } else {
        // Generate new key
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);

        // Save key to file
        fs::write(&key_file_path, &key)
            .map_err(|e| format!("Failed to save encryption key: {}", e))?;

        Ok(key)
    }
}

// Encrypt data
fn encrypt_data(data: &str, app_handle: &tauri::AppHandle) -> Result<String, String> {
    // Get or generate key
    let key_bytes = get_encryption_key(app_handle)?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);

    // Generate a random nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Create cipher instance
    let cipher = Aes256Gcm::new(key);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, data.as_bytes())
        .map_err(|e| format!("Encryption failed: {:?}", e))?;

    // Combine nonce and ciphertext and base64 encode
    let mut combined = Vec::new();
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    // Use the updated base64 encoding method
    Ok(STANDARD.encode(&combined))
}

// Decrypt data
fn decrypt_data(encrypted_data: &str, app_handle: &tauri::AppHandle) -> Result<String, String> {
    // Get encryption key
    let key_bytes = get_encryption_key(app_handle)?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);

    // Decode base64 with updated method
    let combined = STANDARD
        .decode(encrypted_data)
        .map_err(|e| format!("Base64 decoding failed: {}", e))?;

    if combined.len() < 12 {
        return Err("Invalid encrypted data format".to_string());
    }

    // Extract nonce and ciphertext
    let nonce_bytes = &combined[0..12];
    let ciphertext = &combined[12..];

    let nonce = Nonce::from_slice(nonce_bytes);

    // Create cipher instance
    let cipher = Aes256Gcm::new(key);

    // Decrypt
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {:?}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 conversion failed: {}", e))
}

#[tauri::command]
pub fn save_clipboard_history(
    history_data: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let history_file = get_history_file_path(&app_handle)?;

    // Encrypt the history data
    let encrypted_data = encrypt_data(&history_data, &app_handle)?;

    // Save to file
    fs::write(&history_file, encrypted_data)
        .map_err(|e| format!("Failed to save clipboard history: {}", e))
}

#[tauri::command]
pub fn pin_clipboard_item(item_id: u64, app_handle: tauri::AppHandle) -> Result<(), String> {
    // Load the clipboard history
    let history_str = load_clipboard_history(app_handle.clone())?;
    let mut history: ClipboardHistoryFile = serde_json::from_str(&history_str)
        .map_err(|e| format!("Failed to deserialize clipboard history: {}", e))?;

    // Find the item and pin it
    if let Some(item) = history.items.iter_mut().find(|i| i.id == item_id) {
        item.pinned = !item.pinned;
    } else {
        return Err("Item not found".to_string());
    }

    // Save the updated history
    let updated_str = serde_json::to_string(&history)
        .map_err(|e| format!("Failed to serialize updated history: {}", e))?;

    save_clipboard_history(updated_str, app_handle)
}

#[tauri::command]
pub fn load_clipboard_history(app_handle: tauri::AppHandle) -> Result<String, String> {
    let history_file = get_history_file_path(&app_handle)?;

    if !history_file.exists() {
        // Return empty history if file doesn't exist yet
        return Ok(r#"{"items":[]}"#.to_string());
    }

    // Read encrypted data
    let encrypted_data = fs::read_to_string(&history_file)
        .map_err(|e| format!("Failed to read clipboard history file: {}", e))?;

    // Decrypt data
    decrypt_data(&encrypted_data, &app_handle)
}
