use tauri::{Builder, Manager};
use tauri_updater::Updater;
mod updater;  // Add this line

fn main() {
  Builder::default()
    .setup(|app| {
      let updater = Updater::new(app.handle(), "https://example.com/update.json").unwrap();
      app.manage(updater);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      updater::check_for_updates,  // Add this line
      updater::apply_update       // Add this line
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
