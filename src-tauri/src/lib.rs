use std::io::Read;

#[tauri::command]
fn get_audio_snippet(zip_path: String, file_path: String) -> Result<Vec<u8>, String> {
    let file = std::fs::File::open(&zip_path).map_err(|e| format!("Fehler beim Öffnen der ZIP: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Fehler beim Lesen der ZIP: {}", e))?;
    
    // Normalize path separators if needed (zip internally uses /)
    let normalized_path = file_path.replace("\\", "/");
    
    // Exakte Übereinstimmung versuchen
    let has_direct = archive.by_name(&normalized_path).is_ok();
    
    let mut zip_file = if has_direct {
        archive.by_name(&normalized_path).unwrap()
    } else {
        archive.by_name(&format!("site/{}", normalized_path))
            .map_err(|_| format!("Datei {} nicht in ZIP gefunden", normalized_path))?
    };
    
    let mut buffer = Vec::new();
    zip_file.read_to_end(&mut buffer).map_err(|e| format!("Fehler beim Auslesen der Datei: {}", e))?;
    
    Ok(buffer)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![get_audio_snippet])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
