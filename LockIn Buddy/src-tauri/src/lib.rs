// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{PhysicalSize, Size, WindowEvent};

const ASPECT_RATIO: f64 = 4.0 / 3.0;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_window_event(|window, event| {
            if let WindowEvent::Resized(size) = event {
                let width = size.width.max(1);
                let expected_height = ((width as f64) / ASPECT_RATIO).round() as u32;

                if expected_height != size.height {
                    let _ = window.set_size(Size::Physical(PhysicalSize::new(width, expected_height)));
                }
            }
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
