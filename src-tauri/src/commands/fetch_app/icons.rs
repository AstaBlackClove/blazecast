use std::path::Path;
use base64::{engine::general_purpose, Engine as _};
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, DrawIconEx, DI_NORMAL};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateCompatibleBitmap, SelectObject,
    DeleteDC, DeleteObject, GetDC, ReleaseDC, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, BI_RGB
};
use windows::core::PCWSTR;
use std::os::windows::ffi::OsStrExt;

// Extract an icon from the application and return it as a Base64 data URL
pub fn extract_icon(path: &str) -> Option<String> {
    unsafe {
        let path_os = Path::new(path).as_os_str();
        let mut path_w: Vec<u16> = path_os.encode_wide().chain(std::iter::once(0)).collect();
        let mut shfi = SHFILEINFOW::default();
        
        // Get the icon handle
        let result = SHGetFileInfoW(
            PCWSTR(path_w.as_mut_ptr()),
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut shfi as *mut _),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );
        
        if result == 0 || shfi.hIcon.is_invalid() {
            return None;
        }
        
        // Create compatible DC
        let screen_dc = GetDC(None);
        let mem_dc = CreateCompatibleDC(screen_dc);
        
        // Create 32-bit ARGB bitmap for the icon
        let bitmap = CreateCompatibleBitmap(screen_dc, 32, 32);
        let old_bitmap = SelectObject(mem_dc, bitmap);
        
        // Draw the icon to the bitmap
        let result = DrawIconEx(
            mem_dc,
            0, 0,
            shfi.hIcon,
            32, 32,
            0,
            None,
            DI_NORMAL,
        );
        
        if result.as_bool() {
            // Prepare bitmap info structure for 32-bit ARGB
            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: 32,
                    biHeight: -32, // Negative for top-down
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0 as u32,
                    biSizeImage: 0,
                    biXPelsPerMeter: 0,
                    biYPelsPerMeter: 0,
                    biClrUsed: 0,
                    biClrImportant: 0,
                },
                bmiColors: [windows::Win32::Graphics::Gdi::RGBQUAD { rgbBlue: 0, rgbGreen: 0, rgbRed: 0, rgbReserved: 0 }; 1],
            };
            
            let mut pixels = vec![0u8; 32 * 32 * 4];
            
            // Get the bitmap bits
            let result = windows::Win32::Graphics::Gdi::GetDIBits(
                mem_dc,
                bitmap,
                0,
                32,
                Some(pixels.as_mut_ptr() as *mut std::ffi::c_void),
                &mut bmi,
                DIB_RGB_COLORS,
            );
            
            // Clean up GDI resources
            SelectObject(mem_dc, old_bitmap);
            DeleteObject(bitmap);
            DeleteDC(mem_dc);
            ReleaseDC(None, screen_dc);
            DestroyIcon(shfi.hIcon);
            
            if result != 0 {
                // Convert BGRA to RGBA (Windows uses BGRA order)
                for chunk in pixels.chunks_exact_mut(4) {
                    chunk.swap(0, 2); // Swap R and B channels
                }
                
                // Convert pixels to PNG using image crate
                if let Some(img) = image::RgbaImage::from_raw(32, 32, pixels) {
                    let mut png_data = Vec::new();
                    let mut cursor = std::io::Cursor::new(&mut png_data);
                    if img.write_to(&mut cursor, image::ImageOutputFormat::Png).is_ok() {
                        // Convert PNG to base64
                        let base64_png = general_purpose::STANDARD.encode(&png_data);
                        return Some(format!("data:image/png;base64,{}", base64_png));
                    }
                }
            }
        }
        
        // Clean up in case we didn't convert successfully
        DestroyIcon(shfi.hIcon);
        None
    }
}