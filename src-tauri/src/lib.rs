use std::fs::File;
use std::io::Read;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Manager, State, WindowEvent, shell,
};
use zip::ZipArchive;

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

/// Prüft, ob "Reduce Transparency" in den Systemeinstellungen aktiviert ist.
#[tauri::command]
async fn check_reduce_transparency(app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // Auf macOS: NSWorkspace accessibilityDisplayShouldReduceTransparency
        use tauri::Manager;
        let window = app.get_webview_window("main").ok_or("Main window not found")?;
        let ns_window = window.ns_window().map_err(|e| format!("NSWindow error: {}", e))?;
        unsafe {
            let workspace = cocoa::base::class!(NSWorkspace);
            let shared_workspace: cocoa::base::id = msg_send![workspace, sharedWorkspace];
            let reduce_transparency: bool = msg_send![shared_workspace, accessibilityDisplayShouldReduceTransparency];
            Ok(reduce_transparency)
        }
    }
    #[cfg(target_os = "windows")]
    {
        // Auf Windows: SystemParametersInfo mit SPI_GETHIGHCONTRAST
        // oder über das window-vibrancy Crate prüfen
        Ok(false) // TODO: Windows Implementierung
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(false)
    }
}

/// Setzt die Fenster-Vibranz (macOS: NSVisualEffectView, Windows: Mica/Acrylic)
#[tauri::command]
async fn set_window_vibrancy(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;

    #[cfg(target_os = "macos")]
    {
        if enabled {
            apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None)
                .map_err(|e| format!("Vibranz-Fehler: {}", e))?;
        } else {
            // Vibranz deaktivieren - auf Standard zurücksetzen
            apply_vibrancy(&window, NSVisualEffectMaterial::AppearanceBased, None, None)
                .map_err(|e| format!("Vibranz-Fehler: {}", e))?;
        }
    }
    #[cfg(target_os = "windows")]
    {
        if enabled {
            window_vibrancy::apply_mica(&window, None)
                .map_err(|e| format!("Mica-Fehler: {}", e))?;
        } else {
            window_vibrancy::disable(&window)
                .map_err(|e| format!("Mica deaktivieren Fehler: {}", e))?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_menu::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            zip_cache: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_audio_snippet,
            check_reduce_transparency,
            set_window_vibrancy
        ])
        .setup(|app| {
            // Hauptfenster referenzieren
            let window = app.get_webview_window("main").unwrap();

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

            // Native Menüleiste erstellen
            setup_menu(app)?;

            // Reduce Transparency prüfen und an Frontend senden
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(reduce_transparency) = check_reduce_transparency(app_handle.clone()).await {
                    let _ = app_handle.emit("reduce-transparency-changed", reduce_transparency);
                }
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Focused(focused) = event {
                if *focused {
                    // Bei Fokus-Änderung Reduce Transparency neu prüfen
                    let app_handle = window.app_handle().clone();
                    tauri::async_runtime::spawn(async move {
                        if let Ok(reduce_transparency) = check_reduce_transparency(app_handle.clone()).await {
                            let _ = app_handle.emit("reduce-transparency-changed", reduce_transparency);
                        }
                    });
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // App-Menü (macOS: "ZIMSim")
    let app_menu = Submenu::new(
        app,
        "ZIMSim",
        Menu::new()
            .append_item(&MenuItem::new(app, "Über ZIMSim", true, None::<&str>)?)
            .append(&PredefinedMenuItem::separator(app)?) 
            .append_item(&MenuItem::new(app, "Einstellungen...", true, Some("cmd_or_ctrl+,"))?)
            .append(&PredefinedMenuItem::separator(app)?) 
            .append_item(&MenuItem::new(app, "Dienste", true, None::<&str>)?)
            .append(&PredefinedMenuItem::separator(app)?)
            .append_item(&MenuItem::new(app, "ZIMSim ausblenden", true, Some("cmd_or_ctrl+h"))?)
            .append_item(&MenuItem::new(app, "Andere ausblenden", true, Some("cmd_or_ctrl+alt+h"))?)
            .append_item(&MenuItem::new(app, "Alle einblenden", true, None::<&str>)?)
            .append(&PredefinedMenuItem::separator(app)?)
            .append_item(&MenuItem::new(app, "Beenden", true, Some("cmd_or_ctrl+q"))?)?,
    )?;

    // Datei-Menü
    let file_menu = Submenu::new(
        app,
        "Datei",
        Menu::new()
            .append_item(&MenuItem::new(app, "Neue Fahrt", true, Some("cmd_or_ctrl+n"))?)
            .append_item(&MenuItem::new(app, "Fahrten importieren...", true, Some("cmd_or_ctrl+o"))?)
            .append_item(&MenuItem::new(app, "Fahrten exportieren...", true, Some("cmd_or_ctrl+shift+s"))?)
            .append(&PredefinedMenuItem::separator(app)?)
            .append_item(&MenuItem::new(app, "Screenshot speichern...", true, Some("cmd_or_ctrl+shift+4"))?)
            .append(&PredefinedMenuItem::separator(app)?)
            .append_item(&MenuItem::new(app, "Schließen", true, Some("cmd_or_ctrl+w"))?)?,
    )?;

    // Bearbeiten-Menü
    let edit_menu = Submenu::new(
        app,
        "Bearbeiten",
        Menu::new()
            .append_item(&PredefinedMenuItem::undo(app, Some("cmd_or_ctrl+z"))?)
            .append_item(&PredefinedMenuItem::redo(app, Some("cmd_or_ctrl+shift+z"))?)
            .append(&PredefinedMenuItem::separator(app)?)
            .append_item(&PredefinedMenuItem::cut(app, Some("cmd_or_ctrl+x"))?)
            .append_item(&PredefinedMenuItem::copy(app, Some("cmd_or_ctrl+c"))?)
            .append_item(&PredefinedMenuItem::paste(app, Some("cmd_or_ctrl+v"))?)
            .append_item(&PredefinedMenuItem::select_all(app, Some("cmd_or_ctrl+a"))?)?,
    )?;

    // Ansicht-Menü
    let view_menu = Submenu::new(
        app,
        "Ansicht",
        Menu::new()
            .append_item(&MenuItem::new(app, "Vollbild", true, Some("f11"))?)
            .append_item(&MenuItem::new(app, "An Fenster anpassen (Fit)", true, Some("cmd_or_ctrl+0"))?)
            .append_item(&MenuItem::new(app, "Originalgröße (1:1)", true, Some("cmd_or_ctrl+1"))?)
            .append(&PredefinedMenuItem::separator(app)?)
            .append_item(&MenuItem::new(app, "Gehäuse anzeigen", true, Some("cmd_or_ctrl+b"))?)
            .append(&PredefinedMenuItem::separator(app)?)
            .append_item(&MenuItem::new(app, "Monitor 1 öffnen (Full-HD)", true, None::<&str>)?)
            .append_item(&MenuItem::new(app, "Monitor 2 öffnen (Full-HD)", true, None::<&str>)?)
            .append_item(&MenuItem::new(app, "Monitor 3 öffnen (Full-HD)", true, None::<&str>)?)
            .append(&PredefinedMenuItem::separator(app)?)
            .append_item(&MenuItem::new(app, "Monitor 1 öffnen (4K)", true, None::<&str>)?)
            .append_item(&MenuItem::new(app, "Monitor 2 öffnen (4K)", true, None::<&str>)?)
            .append_item(&MenuItem::new(app, "Monitor 3 öffnen (4K)", true, None::<&str>)?)?,
    )?;

    // Fenster-Menü
    let window_menu = Submenu::new(
        app,
        "Fenster",
        Menu::new()
            .append_item(&PredefinedMenuItem::minimize(app, Some("cmd_or_ctrl+m"))?)
            .append_item(&PredefinedMenuItem::zoom(app, None::<&str>)?)
            .append(&PredefinedMenuItem::separator(app)?)
            .append_item(&PredefinedMenuItem::close_window(app, Some("cmd_or_ctrl+w"))?)?,
    )?;

    // Hilfe-Menü
    let help_menu = Submenu::new(
        app,
        "Hilfe",
        Menu::new()
            .append_item(&MenuItem::new(app, "Tastaturkurzbefehle anzeigen", true, Some("cmd_or_ctrl+/"))?)
            .append_item(&MenuItem::new(app, "GitHub Repository", true, None::<&str>)?)
            .append_item(&MenuItem::new(app, "Fehler melden", true, None::<&str>)?)?,
    )?;

    let menu = Menu::new()
        .append_submenu(&app_menu)?
        .append_submenu(&file_menu)?
        .append_submenu(&edit_menu)?
        .append_submenu(&view_menu)?
        .append_submenu(&window_menu)?
        .append_submenu(&help_menu)?;

    app.set_menu(menu)?;

    // Menü-Event-Handler registrieren
    app.on_menu_event(|app, event| {
        match event.id().as_ref() {
            "Über ZIMSim" => {
                // TODO: About-Dialog
            }
            "Einstellungen..." => {
                let _ = app.emit("menu-open-settings", ());
            }
            "Neue Fahrt" => {
                let _ = app.emit("menu-add-journey", ());
            }
            "Fahrten importieren..." => {
                let _ = app.emit("menu-import-journeys", ());
            }
            "Fahrten exportieren..." => {
                let _ = app.emit("menu-export-journeys", ());
            }
            "Screenshot speichern..." => {
                let _ = app.emit("menu-screenshot", ());
            }
            "Vollbild" => {
                let _ = app.emit("menu-toggle-fullscreen", ());
            }
            "An Fenster anpassen (Fit)" => {
                let _ = app.emit("menu-set-scale-fit", ());
            }
            "Originalgröße (1:1)" => {
                let _ = app.emit("menu-set-scale-1to1", ());
            }
            "Gehäuse anzeigen" => {
                let _ = app.emit("menu-toggle-bezel", ());
            }
            "Monitor 1 öffnen (Full-HD)" => {
                let _ = app.emit("menu-open-screen", (1, false));
            }
            "Monitor 2 öffnen (Full-HD)" => {
                let _ = app.emit("menu-open-screen", (2, false));
            }
            "Monitor 3 öffnen (Full-HD)" => {
                let _ = app.emit("menu-open-screen", (3, false));
            }
            "Monitor 1 öffnen (4K)" => {
                let _ = app.emit("menu-open-screen", (1, true));
            }
            "Monitor 2 öffnen (4K)" => {
                let _ = app.emit("menu-open-screen", (2, true));
            }
            "Monitor 3 öffnen (4K)" => {
                let _ = app.emit("menu-open-screen", (3, true));
            }
            "Tastaturkurzbefehle anzeigen" => {
                let _ = app.emit("menu-show-shortcuts", ());
            }
            "GitHub Repository" => {
                let _ = shell::open(&app.shell_scope(), "https://github.com/Jan2903/ZIMSim", None);
            }
            "Fehler melden" => {
                let _ = shell::open(&app.shell_scope(), "https://github.com/Jan2903/ZIMSim/issues/new", None);
            }
            _ => {}
        }
    });

    Ok(())
}