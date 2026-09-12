#[cfg(any(mobile, test))]
mod mobile_host;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_notification::init());
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build());
    #[cfg(mobile)]
    let builder = builder
        .plugin(tauri_plugin_haptics::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            mobile_host::host_info,
            mobile_host::host_connect,
            mobile_host::host_ready,
            mobile_host::host_events,
            mobile_host::host_ack_events,
            mobile_host::host_open_external
        ])
        .setup(mobile_host::setup);
    builder
        .run(tauri::generate_context!())
        .expect("error while running Atlas ERP");
}
