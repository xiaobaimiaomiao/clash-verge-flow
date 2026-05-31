import { useEffect, useState, useCallback } from "react";
import { clashApi } from "../../shared/api/clash";
import type { ProxyProvider } from "../../shared/types/clash";
import { ProfileCard } from "../components/ProfileCard";
import type { ProfileEntry } from "../../shared/types/clash";

const STORAGE_PROFILES = "clashflow_profiles";

export function ProfileSwitch() {
  const [providers, setProviders] = useState<Record<string, ProxyProvider>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProviders = useCallback(async () => {
    try {
      const res = await clashApi.getProxyProviders();
      setProviders(res.providers);
    } catch {}
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const config = await clashApi.getConfig();
      const home = (config as { "config-path"?: string })["config-path"] ?? "";
      setCurrentPath(home);
    } catch {}
  }, []);

  const loadProfiles = useCallback(async () => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get(STORAGE_PROFILES, (res) => {
        const stored: ProfileEntry[] = res[STORAGE_PROFILES] ?? [];
        setProfiles(stored);
        resolve();
      });
    });
  }, []);

  useEffect(() => {
    Promise.all([loadProviders(), loadConfig(), loadProfiles()]).finally(() =>
      setLoading(false),
    );
  }, [loadProviders, loadConfig, loadProfiles]);

  const updateProvider = async (name: string) => {
    setUpdating(name);
    try {
      await clashApi.updateProvider(name);
      await loadProviders();
    } catch {}
    setUpdating(null);
  };

  const switchProfile = async (path: string) => {
    await clashApi.reloadConfig(path);
    await loadConfig();
  };

  const markActive = (p: ProfileEntry) => ({
    ...p,
    active: p.path === currentPath,
  });

  if (loading) {
    return (
      <div className="text-center text-text-secondary text-sm py-8">
        加载中...
      </div>
    );
  }

  const providerEntries = Object.entries(providers).filter(
    ([, p]) => p.vehicleType !== "Compatible" && p.proxies.length > 0,
  );

  return (
    <div className="space-y-4">
      {providerEntries.length > 0 && (
        <div>
          <div className="text-xs font-medium text-text-secondary mb-2">
            代理订阅
          </div>
          <div className="space-y-2">
            {providerEntries.map(([name, prov]) => (
              <div key={name} className="anime-card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium">{name}</div>
                    <div className="text-[10px] text-text-secondary mt-0.5">
                      {prov.proxies.length} 个节点
                      {prov.updatedAt &&
                        ` · 更新于 ${new Date(prov.updatedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => updateProvider(name)}
                    disabled={updating === name}
                    className="anime-btn text-[10px] px-2 py-1 disabled:opacity-50"
                  >
                    {updating === name ? "更新中..." : "⟳ 更新"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-text-secondary mb-2">
          Profile 列表
        </div>
        {profiles.length === 0 ? (
          <div className="anime-card p-4 text-center text-text-secondary text-xs">
            暂未添加 Profile，请在设置中手动添加配置文件路径
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((p, i) => (
              <ProfileCard
                key={i}
                profile={markActive(p)}
                onSwitch={() => switchProfile(p.path)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
