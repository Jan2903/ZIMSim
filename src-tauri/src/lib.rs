use std::fs::File;
use std::io::Read;
use std::sync::Mutex;
use tauri::State;
use zip::ZipArchive;

#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::Manager;

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

struct ZipCache {
    path: String,
    archive: ZipArchive<File>,
}

struct AppState {
    zip_cache: Mutex<Option<ZipCache>>,
}

#[tauri::command]
fn get_audio_snippet(state: State<'_, AppState>, zip_path: String, file_path: String) -> Result<Vec<u8>, String> {
    let mut cache_guard = state.zip_cache.lock().unwrap();

    let needs_load = match &*cache_guard {
        Some(cache) => cache.path != zip_path,
        None => true,
    };

    if needs_load {
        let file = File::open(&zip_path).map_err(|e| format!("Fehler beim Öffnen der ZIP: {}", e))?;
        let archive = ZipArchive::new(file).map_err(|e| format!("Fehler beim Lesen der ZIP: {}", e))?;
        *cache_guard = Some(ZipCache {
            path: zip_path.clone(),
            archive,
        });
    }

    let cache = cache_guard.as_mut().unwrap();
    let archive = &mut cache.archive;

    // Normalize path separators if needed (zip internally uses /)
    let normalized_path = file_path.replace("\\", "/");
    // Verschiedene Pfad-Varianten ausprobieren (Fallback-Logik)
    let mut try_paths = vec![
        normalized_path.clone(),
        format!("site/{}", normalized_path),
    ];

    // Fallback: Wenn 'variante2' (oder andere) gefragt ist, probiere 'variante1'
    if normalized_path.contains("/variante2/") || normalized_path.contains("/variante3/") {
        let fallback = normalized_path.replace("/variante2/", "/variante1/")
                                      .replace("/variante3/", "/variante1/");
        if fallback != normalized_path {
            try_paths.push(fallback.clone());
            try_paths.push(format!("site/{}", fallback));
        }
    }

    let mut zip_file = None;
    for p in try_paths {
        if archive.by_name(&p).is_ok() {
            zip_file = Some(archive.by_name(&p).unwrap());
            break;
        }
    }

    let mut zip_file = zip_file.ok_or_else(|| format!("Datei {} nicht in ZIP gefunden", normalized_path))?;

    let mut buffer = Vec::new();
    zip_file.read_to_end(&mut buffer).map_err(|e| format!("Fehler beim Auslesen der Datei: {}", e))?;

    Ok(buffer)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Hinweis: Es wird bewusst kein eigenes Menü gesetzt (siehe setup_menu-Historie).
    // Tauri installiert dann sein Default-Menü, das auf macOS die Standard-Kürzel
    // für Bearbeiten (Cmd+C/V/X/A) sowie Beenden/Ausblenden bereitstellt.
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .manage(AppState {
            zip_cache: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![get_audio_snippet])
        .setup(|_app| {
            // Hauptfenster für plattformspezifische Vibranz-Effekte referenzieren
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            let window = _app.get_webview_window("main").unwrap();

            // macOS: Vibranz für Sidebar-Material (passt sich Reduce Transparency automatisch an)
            #[cfg(target_os = "macos")]
            {
                let _ = apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None);
            }

            // Windows: Mica aktivieren
            #[cfg(target_os = "windows")]
            {
                let _ = window_vibrancy::apply_mica(&window, None);
            }

            Ok(())
        });

    // Debug-Logging nur in Debug-Builds
    #[cfg(debug_assertions)]
    let builder = builder.plugin(
        tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
    );

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
