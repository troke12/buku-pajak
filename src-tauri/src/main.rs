// Buku Pajak — shell Tauri tipis di atas backend FastAPI yang sudah ada.
//
// Arsitektur: sidecar (binary hasil PyInstaller dari app/sidecar_entry.py)
// tetap menyajikan API + SPA di satu port persis seperti mode dev
// (./run.sh), supaya web/src/lib/api.ts yang fetch "/api/..." relatif
// tidak perlu diubah sama sekali. Window Tauri cuma nunjukin halaman
// loading singkat, lalu di-navigate ke server sidecar begitu siap.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, Url};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const PORT: u16 = 8743;
const HEALTH_TIMEOUT: Duration = Duration::from_secs(15);

struct SidecarHandle(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarHandle(Mutex::new(None)))
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("gagal menentukan folder data aplikasi");
            std::fs::create_dir_all(&data_dir)
                .expect("gagal membuat folder data aplikasi");
            let db_path = data_dir.join("pajak.db");

            let sidecar = app
                .shell()
                .sidecar("buku-pajak-server")
                .expect("sidecar buku-pajak-server tidak terdaftar di tauri.conf.json");

            let (mut rx, child) = sidecar
                .env("PAJAK_DB", db_path.to_string_lossy().to_string())
                .env("PORT", PORT.to_string())
                .spawn()
                .expect("gagal menjalankan sidecar backend");

            app.state::<SidecarHandle>()
                .0
                .lock()
                .expect("lock sidecar handle")
                .replace(child);

            // Teruskan stdout/stderr sidecar ke konsol Tauri — satu-satunya
            // cara lihat log uvicorn selama pengembangan/debug.
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            eprintln!("[sidecar] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[sidecar:err] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Error(err) => {
                            eprintln!("[sidecar] error: {err}");
                        }
                        CommandEvent::Terminated(status) => {
                            eprintln!("[sidecar] berhenti: {status:?}");
                        }
                        _ => {}
                    }
                }
            });

            // Poll TCP sampai sidecar siap nerima koneksi, baru arahkan
            // window utama ke situ. Dijalankan di thread terpisah supaya
            // tidak memblokir startup Tauri.
            let window = app
                .get_webview_window("main")
                .expect("window utama tidak ditemukan");
            std::thread::spawn(move || {
                let addr = format!("127.0.0.1:{PORT}");
                let deadline = Instant::now() + HEALTH_TIMEOUT;
                while Instant::now() < deadline {
                    if TcpStream::connect(&addr).is_ok() {
                        match Url::parse(&format!("http://{addr}")) {
                            Ok(url) => {
                                if let Err(err) = window.navigate(url) {
                                    eprintln!("gagal navigasi ke sidecar: {err}");
                                }
                            }
                            Err(err) => eprintln!("URL sidecar tidak valid: {err}"),
                        }
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(200));
                }
                eprintln!("Sidecar tidak merespons dalam {HEALTH_TIMEOUT:?}.");
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Jalur pertama: tombol close/window manager. RunEvent::Exit di
            // bawah adalah jaring pengaman kedua untuk jalur keluar lain
            // (mis. app.exit() terprogram, Cmd+Q di macOS) yang tidak selalu
            // lewat CloseRequested. Keduanya idempoten (take() cuma sekali).
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                bunuh_sidecar(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("gagal membangun aplikasi Tauri")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                bunuh_sidecar(app_handle);
            }
        });
}

/// Matikan proses sidecar kalau masih hidup. Aman dipanggil berkali-kali —
/// `Option::take()` bikin panggilan kedua jadi no-op.
///
/// Catatan: ini menangani jalur keluar normal aplikasi (tombol close,
/// app.exit(), dll). Kill paksa dari luar (mis. `kill -9`/`kill -TERM` ke
/// proses utama, atau OOM killer) tetap bisa membuat sidecar nyangkut,
/// karena proses utama mati seketika tanpa sempat menjalankan handler apa
/// pun — batasan level OS, bukan sesuatu yang bisa dicegah murni dari kode
/// Rust di sini.
fn bunuh_sidecar(app_handle: &tauri::AppHandle) {
    if let Some(handle) = app_handle.try_state::<SidecarHandle>() {
        if let Some(child) = handle.0.lock().expect("lock sidecar handle").take() {
            let _ = child.kill();
        }
    }
}
