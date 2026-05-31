import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "../../shared/store";
import { clashApi, STORAGE_KEYS, DEFAULT_BASE, DEFAULT_BRIDGE } from "../../shared/api/clash";

const STORAGE_PROFILES = "clashflow_profiles";

interface ProfileItem {
  path: string;
  name: string;
  active?: boolean;
}

export function Settings() {
  const { settings, updateSettings, saveSettings, loadSettings } = useAppStore();
  const [apiBase, setApiBase] = useState(settings.apiBaseUrl);
  const [secret, setSecret] = useState(settings.secret);
  const [bridgeUrl, setBridgeUrl] = useState(settings.bridgeUrl);
  const [delayUrl, setDelayUrl] = useState(settings.delayTestUrl);
  const [particles, setParticles] = useState(settings.particleEnabled);
  const [mascot, setMascot] = useState(settings.mascotIntensity);
  const [connLimit, setConnLimit] = useState(settings.connectionLimit);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [newPath, setNewPath] = useState("");
  const [newName, setNewName] = useState("");
  const [tested, setTested] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_PROFILES, (res) => {
      setProfiles(res[STORAGE_PROFILES] ?? []);
    });
  }, []);

  const testConnection = useCallback(async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.BASE]: apiBase,
      [STORAGE_KEYS.SECRET]: secret,
    });
    const ok = await clashApi.ping();
    setTested(ok);
    setTimeout(() => setTested(null), 2000);
  }, [apiBase, secret]);

  const handleSave = useCallback(async () => {
    updateSettings({
      apiBaseUrl: apiBase,
      secret,
      bridgeUrl,
      delayTestUrl: delayUrl,
      particleEnabled: particles,
      mascotIntensity: mascot,
      connectionLimit: connLimit,
    });
    await saveSettings();
    await chrome.storage.local.set({
      [STORAGE_KEYS.BASE]: apiBase,
      [STORAGE_KEYS.SECRET]: secret,
      [STORAGE_KEYS.BRIDGE]: bridgeUrl,
    });
  }, [apiBase, secret, bridgeUrl, delayUrl, particles, mascot, connLimit, updateSettings, saveSettings]);

  const addProfile = () => {
    if (!newPath.trim()) return;
    const next = [
      ...profiles,
      { path: newPath.trim(), name: newName.trim() || newPath.trim().split(/[\\/]/).pop() || "Profile" },
    ];
    setProfiles(next);
    chrome.storage.local.set({ [STORAGE_PROFILES]: next });
    setNewPath("");
    setNewName("");
  };

  const removeProfile = (i: number) => {
    const next = profiles.filter((_, idx) => idx !== i);
    setProfiles(next);
    chrome.storage.local.set({ [STORAGE_PROFILES]: next });
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className="text-[11px] text-text-secondary block mb-1">
          Clash API 地址
        </label>
        <input
          className="anime-input"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          placeholder={DEFAULT_BASE}
        />
      </div>

      <div>
        <label className="text-[11px] text-text-secondary block mb-1">
          Secret (可选)
        </label>
        <input
          className="anime-input"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="如果 Clash 配置了 external-controller secret"
        />
      </div>

      <div>
        <label className="text-[11px] text-text-secondary block mb-1">
          Clash Verge Bridge 地址
        </label>
        <input
          className="anime-input"
          value={bridgeUrl}
          onChange={(e) => setBridgeUrl(e.target.value)}
          placeholder={DEFAULT_BRIDGE}
        />
        <div className="text-[10px] text-text-secondary/60 mt-0.5">
          Clash Verge Rev 内嵌服务的地址，用于直接写入规则
        </div>
      </div>

      <button onClick={testConnection} className="anime-btn w-full">
        {tested === null
          ? "测试连接"
          : tested
            ? "✓ 连接成功"
            : "✕ 连接失败"}
      </button>

      <div>
        <label className="text-[11px] text-text-secondary block mb-1">
          延迟测试 URL
        </label>
        <input
          className="anime-input"
          value={delayUrl}
          onChange={(e) => setDelayUrl(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">樱花粒子特效</span>
        <button
          onClick={() => setParticles(!particles)}
          className={`w-10 h-5 rounded-full transition-all ${
            particles ? "bg-sakura-200" : "bg-gray-600"
          } relative`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
              particles ? "left-5.5" : "left-0.5"
            }`}
            style={{ left: particles ? "22px" : "2px" }}
          />
        </button>
      </div>

      <div>
        <label className="text-[11px] text-text-secondary block mb-1">
          看板娘表情强度
        </label>
        <div className="flex gap-2">
          {(["high", "medium", "low"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMascot(m)}
              className={`flex-1 px-2 py-1.5 rounded text-[11px] transition-all ${
                mascot === m
                  ? "bg-sakura-200/20 text-sakura-200 border border-sakura-200/30"
                  : "bg-anime-bg-card text-text-secondary border border-transparent"
              }`}
            >
              {m === "high" ? "丰富" : m === "medium" ? "适中" : "低调"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-text-secondary block mb-1">
          连接日志上限
        </label>
        <input
          className="anime-input"
          type="number"
          min={10}
          max={200}
          value={connLimit}
          onChange={(e) => setConnLimit(Number(e.target.value))}
        />
      </div>

      <div>
        <label className="text-[11px] text-text-secondary block mb-2">
          Profile 路径管理
        </label>
        <div className="space-y-1 mb-2">
          {profiles.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-[11px] bg-anime-bg-card rounded px-2 py-1.5"
            >
              <span className="flex-1 truncate">{p.name}</span>
              <button
                onClick={() => removeProfile(i)}
                className="text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            className="anime-input flex-1 text-[11px]"
            placeholder="YAML 文件路径"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
          />
          <button onClick={addProfile} className="anime-btn px-2 text-[11px]">
            +
          </button>
        </div>
      </div>

      <button onClick={handleSave} className="anime-btn anime-btn-primary w-full">
        ✧ 保存设置
      </button>
    </div>
  );
}
