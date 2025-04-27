use arboard::ImageData as ArboardImageData;
use image::{DynamicImage, GenericImageView};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;

// Function to get image from clipboard
#[tauri::command]
pub fn get_clipboard_image(
    _window: tauri::Window,
    app_handle: tauri::AppHandle,
) -> Result<Option<ImageResponse>, String> {
    match arboard::Clipboard::new() {
        Ok(mut clipboard) => {
            match clipboard.get_image() {
                Ok(image_data) => {
                    // Process the image
                    let width = image_data.width as u32;
                    let height = image_data.height as u32;

                    // Generate a simple hash of the image data
                    let mut hasher = Sha256::new();
                    hasher.update(&image_data.bytes);
                    let hash = format!("{:x}", hasher.finalize());

                    // Save the image to a file in the app's data directory
                    let app_data_dir = app_handle
                        .path_resolver()
                        .app_data_dir()
                        .ok_or_else(|| "Failed to get app data directory".to_string())?;

                    let images_dir = app_data_dir.join("clipboard_images");
                    if !images_dir.exists() {
                        std::fs::create_dir_all(&images_dir)
                            .map_err(|e| format!("Failed to create images directory: {}", e))?;
                    }

                    let image_path = images_dir.join(format!("{}.png", hash));
                    let image_path_str = image_path.to_string_lossy().to_string();

                    // Create the DynamicImage and save it
                    let img = DynamicImage::ImageRgba8(
                        image::RgbaImage::from_raw(width, height, image_data.bytes.to_vec())
                            .ok_or_else(|| "Fto_vec to create image from raw data".to_string())?,
                    );

                    // Resize large images to reduce memory usage
                    let img = if width > 1200 || height > 1200 {
                        img.resize(1200, 1200, image::imageops::FilterType::Lanczos3)
                    } else {
                        img
                    };

                    img.save(&image_path)
                        .map_err(|e| format!("Failed to save image: {}", e))?;

                    Ok(Some(ImageResponse {
                        width,
                        height,
                        hash,
                        file_path: image_path_str,
                    }))
                }
                Err(_) => {
                    // No image in clipboard, return None instead of an error
                    Ok(None)
                }
            }
        }
        Err(e) => Err(format!("Failed to create clipboard: {}", e)),
    }
}

// Function to set image to clipboard
#[tauri::command]
pub fn set_clipboard_image(file_path: String, _window: tauri::Window) -> Result<(), String> {
    let img = image::open(&file_path).map_err(|e| format!("Failed to open image file: {}", e))?;

    let (width, height) = img.dimensions();
    let rgba_image = img.to_rgba8();
    let bytes = rgba_image.into_raw();

    let image_data = ArboardImageData {
        width: width as usize,
        height: height as usize,
        bytes: bytes.into(),
    };

    match arboard::Clipboard::new() {
        Ok(mut clipboard) => match clipboard.set_image(image_data) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to set clipboard image: {}", e)),
        },
        Err(e) => Err(format!("Failed to create clipboard: {}", e)),
    }
}

#[tauri::command]
pub fn load_clipboard_image_bytes(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(file_path).map_err(|e| format!("Failed to read image file: {}", e))
}

#[tauri::command]
pub fn delete_clipboard_image_file(file_path: String) -> Result<(), String> {
    if std::path::Path::new(&file_path).exists() {
        std::fs::remove_file(file_path)
            .map_err(|e| format!("Failed to delete image file: {}", e))?;
    }
    Ok(())
}

// Response structure for image data
#[derive(Serialize)]
pub struct ImageResponse {
    pub width: u32,
    pub height: u32,
    pub hash: String,
    pub file_path: String,
}
