//! T15 read-only export verifier. Uses the release's canonical renderer; never exports files.
use serde_json::{Value, json};
use std::{collections::BTreeSet, fs, io::Write, path::Path};
use unleashd_buddies::store::sha256_hex;
use unleashd_buddies_import::notes;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 4 || !matches!(args[1].as_str(), "plan" | "verify") {
        return Err("usage: t15-export-manifest plan|verify SOURCE.sqlite MANIFEST.json".into());
    }
    let source = Path::new(&args[2]);
    let mut files = notes::plan(source)?;
    files.extend(notes::archive_plan(source)?);
    let mut paths = BTreeSet::new();
    for file in &files {
        if !paths.insert(file.path.clone()) {
            return Err(format!("duplicate export destination: {}", file.path.display()).into());
        }
    }
    let expected = json!({
        "source_sha256": sha256_hex(&fs::read(source)?),
        "files": files.iter().map(|f| json!({
            "path": f.path, "buddy_id": f.buddy_id, "sections": f.sections,
            "bytes": f.text.len(), "sha256": sha256_hex(f.text.as_bytes())
        })).collect::<Vec<_>>()
    });
    if args[1] == "plan" {
        for file in &files {
            match fs::symlink_metadata(&file.path) {
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(e.into()),
                Ok(_) => return Err(format!("destination exists: {}", file.path.display()).into()),
            }
        }
        let mut out = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&args[3])?;
        writeln!(out, "{}", serde_json::to_string_pretty(&expected)?)?;
        println!(
            "planned {} files; destinations absent; manifest created",
            files.len()
        );
    } else {
        let saved: Value = serde_json::from_slice(&fs::read(&args[3])?)?;
        if saved != expected {
            return Err("manifest differs from source/renderer; do not export or start".into());
        }
        for file in &files {
            if !fs::symlink_metadata(&file.path)?.file_type().is_file() {
                return Err(format!("not a regular export file: {}", file.path.display()).into());
            }
            if sha256_hex(&fs::read(&file.path)?) != sha256_hex(file.text.as_bytes()) {
                return Err(format!("export content differs: {}", file.path.display()).into());
            }
        }
        println!(
            "verified {} actual files against source-rendered SHA-256",
            files.len()
        );
    }
    Ok(())
}
