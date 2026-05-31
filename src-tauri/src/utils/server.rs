use super::resolve;
use crate::{
    cmd::is_port_in_use,
    config::{Config, DEFAULT_PAC, IVerge},
    module::lightweight,
    process::AsyncHandler,
    utils::{help, network::{NetworkManager, ProxyType}, window_manager::WindowManager},
};
use anyhow::{Result, bail};
use clash_verge_logging::{Type, logging, logging_error};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use reqwest::ClientBuilder;
use smartstring::alias::String;
use std::time::{Duration, Instant};
use tokio::sync::oneshot;
use warp::Filter as _;

#[derive(serde::Deserialize, Debug)]
struct QueryParam {
    param: String,
}

// 关闭 embedded server 的信号发送端
static SHUTDOWN_SENDER: OnceCell<Mutex<Option<oneshot::Sender<()>>>> = OnceCell::new();

const IP_INFO_CACHE_TTL: Duration = Duration::from_secs(300);
static IP_INFO_CACHE: OnceCell<Mutex<Option<(Instant, std::string::String)>>> = OnceCell::new();

fn ip_info_cache() -> &'static Mutex<Option<(Instant, std::string::String)>> {
    IP_INFO_CACHE.get_or_init(|| Mutex::new(None))
}

/// check whether there is already exists
pub async fn check_singleton() -> Result<()> {
    let port = IVerge::get_singleton_port();
    if is_port_in_use(port) {
        let client = ClientBuilder::new().timeout(Duration::from_millis(500)).build()?;
        // 需要确保 Send
        #[allow(clippy::needless_collect)]
        let argvs: Vec<std::string::String> = std::env::args().collect();
        if argvs.len() > 1 {
            #[cfg(not(target_os = "macos"))]
            {
                let param = argvs[1].as_str();
                if param.starts_with("clash:") {
                    client
                        .get(format!("http://127.0.0.1:{port}/commands/scheme?param={param}"))
                        .send()
                        .await?;
                }
            }
        } else {
            client
                .get(format!("http://127.0.0.1:{port}/commands/visible"))
                .send()
                .await?;
        }
        logging!(error, Type::Window, "failed to setup singleton listen server");
        bail!("app exists");
    }
    Ok(())
}

/// The embed server only be used to implement singleton process
/// maybe it can be used as pac server later
pub fn embed_server() {
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    #[allow(clippy::expect_used)]
    SHUTDOWN_SENDER
        .set(Mutex::new(Some(shutdown_tx)))
        .expect("failed to set shutdown signal for embedded server");
    let port = IVerge::get_singleton_port();

    let visible = warp::path!("commands" / "visible").and_then(|| async {
        logging!(info, Type::Window, "检测到从单例模式恢复应用窗口");
        if !lightweight::exit_lightweight_mode().await {
            WindowManager::show_main_window().await;
        } else {
            logging!(error, Type::Window, "轻量模式退出失败，无法恢复应用窗口");
        };
        Ok::<_, warp::Rejection>(warp::reply::with_status::<std::string::String>(
            "ok".to_string(),
            warp::http::StatusCode::OK,
        ))
    });

    let pac = warp::path!("commands" / "pac").and_then(|| async move {
        let verge_config = Config::verge().await;
        let clash_config = Config::clash().await;

        let pac_content = verge_config
            .data_arc()
            .pac_file_content
            .clone()
            .unwrap_or_else(|| DEFAULT_PAC.into());

        let pac_port = verge_config
            .data_arc()
            .verge_mixed_port
            .unwrap_or_else(|| clash_config.data_arc().get_mixed_port());
        let processed_content = pac_content.replace("%mixed-port%", &format!("{pac_port}"));
        Ok::<_, warp::Rejection>(
            warp::http::Response::builder()
                .header("Content-Type", "application/x-ns-proxy-autoconfig")
                .body(processed_content)
                .unwrap_or_default(),
        )
    });

    // Use map instead of and_then to avoid Send issues
    let scheme = warp::path!("commands" / "scheme")
        .and(warp::query::<QueryParam>())
        .and_then(|query: QueryParam| async move {
            AsyncHandler::spawn(|| async move {
                logging_error!(Type::Setup, resolve::resolve_scheme(&query.param).await);
            });
            Ok::<_, warp::Rejection>(warp::reply::with_status::<std::string::String>(
                "ok".to_string(),
                warp::http::StatusCode::OK,
            ))
        });

    // Browser extension bridge: add rules to active profile
    let extension_rules = warp::path!("commands" / "extension" / "rules")
        .and(warp::post())
        .and(warp::body::json())
        .and_then(|body: serde_json::Value| async move {
            let result = handle_extension_add_rules(body).await;
            match result {
                Ok(reply_str) => Ok::<_, warp::Rejection>(warp::reply::with_status(
                    reply_str,
                    warp::http::StatusCode::OK,
                )),
                Err(e) => Ok(warp::reply::with_status(
                    format!("{{\"error\":\"{}\"}}", e),
                    warp::http::StatusCode::INTERNAL_SERVER_ERROR,
                )),
            }
        });

    // Browser extension bridge: get IP info (proxied through clash core)
    let extension_ip_info = warp::path!("commands" / "extension" / "ip-info")
        .and(warp::get())
        .and_then(|| async move {
            let result = handle_extension_ip_info().await;
            match result {
                Ok(body) => Ok::<_, warp::Rejection>(
                    warp::http::Response::builder()
                        .header("Content-Type", "application/json")
                        .status(warp::http::StatusCode::OK)
                        .body(body)
                        .unwrap_or_default(),
                ),
                Err(e) => Ok(warp::http::Response::builder()
                    .header("Content-Type", "application/json")
                    .status(warp::http::StatusCode::INTERNAL_SERVER_ERROR)
                    .body(format!("{{\"error\":\"{e}\"}}"))
                    .unwrap_or_default()),
            }
        });

    // Browser extension bridge: get system info (verge version, auto launch, running mode)
    let extension_system_info = warp::path!("commands" / "extension" / "system-info")
        .and(warp::get())
        .and_then(|| async move {
            let result = handle_extension_system_info().await;
            match result {
                Ok(body) => Ok::<_, warp::Rejection>(
                    warp::http::Response::builder()
                        .header("Content-Type", "application/json")
                        .status(warp::http::StatusCode::OK)
                        .body(body)
                        .unwrap_or_default(),
                ),
                Err(e) => Ok(warp::http::Response::builder()
                    .header("Content-Type", "application/json")
                    .status(warp::http::StatusCode::INTERNAL_SERVER_ERROR)
                    .body(format!("{{\"error\":\"{e}\"}}"))
                    .unwrap_or_default()),
            }
        });

    let cors = warp::cors()
        .allow_any_origin()
        .allow_headers(vec!["Content-Type", "Authorization"])
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE"]);

    let commands = visible
        .or(scheme)
        .or(pac)
        .or(extension_rules)
        .or(extension_ip_info)
        .or(extension_system_info)
        .with(cors);

    AsyncHandler::spawn(move || async move {
        warp::serve(commands)
            .bind(([127, 0, 0, 1], port))
            .await
            .graceful(async {
                shutdown_rx.await.ok();
            })
            .run()
            .await;
    });
}

pub async fn handle_extension_add_rules(
    body: serde_json::Value,
) -> Result<std::string::String, std::string::String> {
    use crate::config::Config;
    use crate::core::CoreManager;
    use crate::enhance::seq::SeqMap;
    use crate::utils::dirs;
    use crate::utils::tmpl;
    use serde_yaml_ng::{Sequence, Value};
    use tokio::fs;

    let rules_arr = body
        .get("rules")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "missing rules array".to_string())?;

    let new_rules: Vec<std::string::String> = rules_arr
        .iter()
        .filter_map(|r| r.as_str().map(std::string::String::from))
        .collect();

    if new_rules.is_empty() {
        return Err("no valid rules provided".into());
    }

    logging!(
        info,
        Type::Config,
        "[extension bridge] 添加 {} 条规则",
        new_rules.len()
    );

    let profiles_draft = Config::profiles().await;
    let profiles_arc = profiles_draft.data_arc();

    let current_uid = profiles_arc
        .get_current()
        .ok_or_else(|| "no active profile".to_string())?
        .clone();

    let current_item = profiles_arc
        .get_item(&current_uid)
        .map_err(|e| format!("failed to get current profile: {e}"))?
        .clone();

    let rules_uid = current_item
        .option
        .as_ref()
        .and_then(|o| o.rules.clone())
        .unwrap_or_default()
        .to_string();

    drop(profiles_arc);
    drop(profiles_draft);

    let profiles_dir =
        dirs::app_profiles_dir().map_err(|e| format!("failed to get profiles dir: {e}"))?;

    let (rules_file_uid, rules_file_path, created_now) = if rules_uid.is_empty() {
        let new_uid: std::string::String = format!("r{}", help::get_uid("r"));
        let new_filename = format!("{new_uid}.yaml");
        let path = profiles_dir.join(&new_filename);
        fs::write(&path, tmpl::ITEM_RULES)
            .await
            .map_err(|e| format!("failed to create rules file: {e}"))?;
        logging!(
            info,
            Type::Config,
            "[extension bridge] 创建规则增强文件: {}",
            new_filename
        );
        (new_uid, path, true)
    } else {
        let filename = format!("{rules_uid}.yaml");
        let path = profiles_dir.join(&filename);
        if !path.exists() {
            fs::write(&path, tmpl::ITEM_RULES)
                .await
                .map_err(|e| format!("failed to create rules file: {e}"))?;
        }
        (rules_uid, path, false)
    };

    let content = fs::read_to_string(&rules_file_path)
        .await
        .unwrap_or_else(|_| tmpl::ITEM_RULES.into());

    let mut seq_map: SeqMap = serde_yaml_ng::from_str(&content).unwrap_or_default();

    let mut updated_prepend = Sequence::new();
    for rule in &new_rules {
        updated_prepend.push(Value::String(rule.clone()));
    }
    updated_prepend.extend(std::mem::take(&mut seq_map.prepend));
    seq_map.prepend = updated_prepend;

    let new_yaml = serde_yaml_ng::to_string(&seq_map).unwrap_or(content);
    fs::write(&rules_file_path, new_yaml.as_bytes())
        .await
        .map_err(|e| format!("failed to write rules file: {e}"))?;

    if created_now {
        let profiles = Config::profiles().await;
        let profiles_ref = profiles.latest_arc();
        if let Ok(existing) = profiles_ref.get_item(&current_uid) {
            let mut merged = existing.clone();
            let mut new_opt = merged.option.clone().unwrap_or_default();
            new_opt.rules = Some(rules_file_uid.as_str().into());
            merged.option = Some(new_opt);
            drop(profiles_ref);
            let _ =
                crate::config::profiles::profiles_patch_item_safe(&current_uid, &merged).await;
        }
        drop(profiles);
        let _ = crate::config::profiles::profiles_save_file_safe().await;
    }

    match CoreManager::global().update_config_forced().await {
        Ok(_) => {
            crate::core::handle::Handle::refresh_clash();
            logging!(
                info,
                Type::Config,
                "[extension bridge] 规则添加完成，已重载配置"
            );
            Ok(format!(
                "{{\"ok\":true,\"count\":{},\"uid\":\"{}\"}}",
                new_rules.len(),
                rules_file_uid
            ))
        }
        Err(e) => {
            logging!(
                error,
                Type::Config,
                "[extension bridge] 重载配置失败: {}",
                e
            );
            Err(format!("reload failed: {e}"))
        }
    }
}

const IP_CHECK_SERVICES: &[(&str, fn(&serde_json::Value) -> serde_json::Value)] = &[
    ("https://api.ip.sb/geoip", |d| {
        serde_json::json!({
            "ip": d["ip"].as_str().unwrap_or(""),
            "country_code": d["country_code"].as_str().unwrap_or(""),
            "country": d["country"].as_str().unwrap_or(""),
            "region": d["region"].as_str().unwrap_or(""),
            "city": d["city"].as_str().unwrap_or(""),
            "organization": d["organization"].as_str().unwrap_or(""),
            "isp": d["isp"].as_str().unwrap_or(""),
            "asn": d["asn"].as_u64().unwrap_or(0),
            "asn_organization": d["asn_organization"].as_str().unwrap_or(""),
            "longitude": d["longitude"].as_f64().unwrap_or(0.0),
            "latitude": d["latitude"].as_f64().unwrap_or(0.0),
            "timezone": d["timezone"].as_str().unwrap_or(""),
        })
    }),
    ("https://ipapi.co/json", |d| {
        let asn: u64 = d["asn"]
            .as_str()
            .unwrap_or("")
            .trim_start_matches("AS")
            .trim_start_matches("as")
            .parse()
            .unwrap_or(0);
        serde_json::json!({
            "ip": d["ip"].as_str().unwrap_or(""),
            "country_code": d["country_code"].as_str().unwrap_or(""),
            "country": d["country_name"].as_str().unwrap_or(d["country"].as_str().unwrap_or("")),
            "region": d["region"].as_str().unwrap_or(""),
            "city": d["city"].as_str().unwrap_or(""),
            "organization": d["org"].as_str().unwrap_or(""),
            "isp": d["org"].as_str().unwrap_or(""),
            "asn": asn,
            "asn_organization": d["org"].as_str().unwrap_or(""),
            "longitude": d["longitude"].as_f64().unwrap_or(0.0),
            "latitude": d["latitude"].as_f64().unwrap_or(0.0),
            "timezone": d["timezone"].as_str().unwrap_or(""),
        })
    }),
    ("https://ipwho.is/", |d| {
        let loc = &d["connection"];
        serde_json::json!({
            "ip": d["ip"].as_str().unwrap_or(""),
            "country_code": d["country_code"].as_str().unwrap_or(""),
            "country": d["country"].as_str().unwrap_or(""),
            "region": d["region"].as_str().unwrap_or(""),
            "city": d["city"].as_str().unwrap_or(""),
            "organization": loc["org"].as_str().unwrap_or(loc["isp"].as_str().unwrap_or("")),
            "isp": loc["isp"].as_str().unwrap_or(""),
            "asn": loc["asn"].as_u64().unwrap_or(0),
            "asn_organization": loc["isp"].as_str().unwrap_or(""),
            "longitude": d["longitude"].as_f64().unwrap_or(0.0),
            "latitude": d["latitude"].as_f64().unwrap_or(0.0),
            "timezone": d["timezone"]["id"].as_str().unwrap_or(""),
        })
    }),
];

async fn handle_extension_ip_info() -> Result<std::string::String, std::string::String> {
    {
        let cache = ip_info_cache().lock();
        if let Some((fetched_at, body)) = cache.as_ref() {
            if fetched_at.elapsed() < IP_INFO_CACHE_TTL {
                return Ok(body.clone());
            }
        }
    }

    let manager = NetworkManager::new();
    let mut last_err: Option<std::string::String> = None;

    for &(url, normalize) in IP_CHECK_SERVICES {
        match manager
            .get_with_interrupt(url, ProxyType::Localhost, Some(6), None, false)
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                let body = resp
                    .text_with_charset()
                    .map_err(|e| e.to_string())?
                    .to_string();
                if let Ok(raw) = serde_json::from_str::<serde_json::Value>(&body) {
                    if raw.get("ip").and_then(|v| v.as_str()).is_some_and(|s| !s.is_empty()) {
                        let normalized = normalize(&raw);
                        let normalized_str = normalized.to_string();
                        logging!(
                            info,
                            Type::Network,
                            "[extension bridge] IP info fetched: {url}"
                        );
                        *ip_info_cache().lock() = Some((Instant::now(), normalized_str.clone()));
                        return Ok(normalized_str);
                    }
                }
                last_err = Some(format!("invalid response from {url}"));
            }
            Ok(resp) => {
                last_err = Some(format!("HTTP {} from {url}", resp.status()));
            }
            Err(e) => {
                last_err = Some(format!("{e}"));
            }
        }
    }

    Err(last_err.unwrap_or_else(|| "all IP services failed".into()))
}

async fn handle_extension_system_info() -> Result<std::string::String, std::string::String> {
    let verge_cfg = Config::verge().await;
    let verge = verge_cfg.data_arc();

    let auto_launch = verge.enable_auto_launch.unwrap_or(false);

    let mode = crate::core::CoreManager::global()
        .get_running_mode()
        .to_string();

    let verge_version = env!("CARGO_PKG_VERSION").to_string();

    Ok(format!(
        "{{\"autoLaunch\":{},\"runningMode\":\"{}\",\"vergeVersion\":\"{}\"}}",
        auto_launch, mode, verge_version
    ))
}

pub fn shutdown_embedded_server() {
    logging!(info, Type::Window, "shutting down embedded server");
    if let Some(sender) = SHUTDOWN_SENDER.get()
        && let Some(sender) = sender.lock().take()
    {
        sender.send(()).ok();
    }
}
