// Fichiers : données de l'app dans %APPDATA%\IrisStudio, projets dans Documents\IrisStudio, exports dans Musique\IrisStudio.
use std::path::PathBuf;

pub fn data_dir() -> PathBuf {
    dirs::config_dir().unwrap_or_else(|| PathBuf::from(".")).join("IrisStudio")
}
pub fn autosave_file() -> PathBuf {
    data_dir().join("autosave.irisp")
}
pub fn projects_dir() -> PathBuf {
    dirs::document_dir().unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Documents")).join("IrisStudio")
}
pub fn exports_dir() -> PathBuf {
    dirs::audio_dir().unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Music")).join("IrisStudio")
}

pub use iris_store::{read_json, write_json};

pub use iris_store::{open_path, open_url, show_in_folder};
