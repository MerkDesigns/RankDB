fn main() {
    // A custom capabilities pattern stops tauri-build from watching the folder, so a capability
    // edit alone would never re-run this script. Cargo rescans a watched directory recursively.
    println!("cargo:rerun-if-changed=capabilities");
    println!("cargo:rerun-if-changed=../src/text/strings.json");

    // The MCP bridge capability lives in a subfolder so normal builds never reference a plugin
    // that is not compiled in.
    let capabilities = if std::env::var_os("CARGO_FEATURE_MCP_DEVELOPMENT").is_some() {
        "./capabilities/**/*.json"
    } else {
        "./capabilities/*.json"
    };
    tauri_build::try_build(tauri_build::Attributes::new().capabilities_path_pattern(capabilities))
        .expect("failed to run Tauri build script");
}
