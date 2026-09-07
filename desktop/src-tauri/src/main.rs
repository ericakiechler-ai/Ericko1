// 845-VEC desktop shell.
//
// Deliberately empty of logic. The calculator is the same single HTML file the
// browser build ships, bundled unchanged into the binary's resources. Keeping
// zero application logic in Rust means there is exactly one implementation of
// every calculation, and the desktop build cannot drift from the file a
// customer already trusts.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to start 845-VEC");
}
