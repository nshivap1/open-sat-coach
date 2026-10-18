//! Open SAT Coach desktop shell.
//!
//! Every command returns `Result<T, String>`; blocking work runs on
//! `tauri::async_runtime::spawn_blocking` so the UI thread never waits.

mod device;
mod llama;
mod net;
mod scan;
mod storage;

/// Runs a blocking closure off the async runtime and flattens the join error.
pub(crate) async fn blocking<T, F>(f: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    match tauri::async_runtime::spawn_blocking(f).await {
        Ok(result) => result,
        Err(e) => Err(format!("Background task failed: {e}")),
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        .manage(storage::DbState::default())
        .manage(llama::LlamaState::default())
        .invoke_handler(tauri::generate_handler![
            storage::load_state,
            storage::save_state,
            net::http_local,
            scan::scan_models,
            llama::start_llama,
            llama::stop_llama,
            llama::llama_status,
            device::device_info,
            device::open_external,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Open SAT Coach");

    app.run(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
            llama::shutdown(app_handle);
        }
        _ => {}
    });
}
