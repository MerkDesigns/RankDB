use std::path::Path;

/// Product facts come from the app's own Tauri config, so the setup can never disagree with the
/// installer it carries.
fn product_facts() -> [(&'static str, String); 3] {
    let read = |path: &str| -> serde_json::Value {
        let text = std::fs::read_to_string(path).unwrap_or_else(|error| panic!("{path}: {error}"));
        serde_json::from_str(&text).unwrap_or_else(|error| panic!("{path}: {error}"))
    };
    let config = read("../src-tauri/tauri.conf.json");
    let field = |key: &str| config[key].as_str().map(str::to_owned);
    // The app's version: the build script's (the same), else package.json's, which tauri.conf.json
    // names as its version.
    let version = std::env::var("RANKDB_INSTALLER_VERSION").unwrap_or_else(|_| {
        read("../package.json")["version"].as_str().expect("package.json has no version").to_owned()
    });
    [
        ("RANKDB_PRODUCT_NAME", field("productName").expect("tauri.conf.json has no productName")),
        ("RANKDB_IDENTIFIER", field("identifier").expect("tauri.conf.json has no identifier")),
        ("RANKDB_PRODUCT_VERSION", version),
    ]
}

fn main() {
    println!("cargo::rerun-if-changed=../src-tauri/tauri.conf.json");
    println!("cargo::rerun-if-changed=../package.json");
    println!("cargo::rerun-if-changed=capabilities");
    println!("cargo::rerun-if-env-changed=RANKDB_INSTALLER_VERSION");
    println!("cargo::rerun-if-env-changed=RANKDB_INSTALLER_PAYLOAD");
    println!("cargo::rustc-check-cfg=cfg(embedded_payload)");

    for (name, value) in product_facts() {
        println!("cargo::rustc-env={name}={value}");
    }

    // Release builds must carry the NSIS installer they present; only development builds may
    // simulate installing.
    match std::env::var("RANKDB_INSTALLER_PAYLOAD") {
        Ok(payload) => {
            let payload = Path::new(&payload)
                .canonicalize()
                .unwrap_or_else(|error| panic!("RANKDB_INSTALLER_PAYLOAD {payload}: {error}"));
            println!("cargo::rerun-if-changed={}", payload.display());
            println!("cargo::rustc-env=RANKDB_PAYLOAD_PATH={}", payload.display());
            println!("cargo::rustc-cfg=embedded_payload");
        }
        Err(_) if std::env::var("PROFILE").as_deref() == Ok("release") => {
            panic!("release builds need RANKDB_INSTALLER_PAYLOAD (use npm run installer:build)")
        }
        Err(_) => {}
    }

    let commands: &'static [&'static str] = &[
        "installer_details",
        "installer_choose_location",
        "installer_app_running",
        "installer_run",
        "installer_launch",
    ];
    // The MCP bridge capability lives in a subfolder so normal builds never reference a plugin
    // that is not compiled in.
    let capabilities = if std::env::var_os("CARGO_FEATURE_MCP_DEVELOPMENT").is_some() {
        "./capabilities/**/*.json"
    } else {
        "./capabilities/*.json"
    };
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(commands))
        .capabilities_path_pattern(capabilities);
    tauri_build::try_build(attributes).expect("failed to run Tauri build script");
}
