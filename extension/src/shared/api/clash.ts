import type {
  ClashConfig,
  ClashRule,
  Connection,
  ConnectionsData,
  IpInfo,
  LogEntry,
  ProxiesResponse,
  ProxyProvidersResponse,
  RulesResponse,
  SystemInfo,
  TrafficData,
} from "../types/clash";

const DEFAULT_BASE = "http://127.0.0.1:9090";
const DEFAULT_BRIDGE = "http://127.0.0.1:33331";
const STORAGE_KEYS = {
  BASE: "clash_api_base",
  SECRET: "clash_api_secret",
  BRIDGE: "clash_verge_bridge",
};

async function getApiBase(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.BASE, (res) => {
      resolve(res[STORAGE_KEYS.BASE] || DEFAULT_BASE);
    });
  });
}

async function getSecret(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SECRET, (res) => {
      resolve(res[STORAGE_KEYS.SECRET] || "set-your-secret");
    });
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const [base, secret] = await Promise.all([getApiBase(), getSecret()]);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`Clash API ${res.status}: ${res.statusText}`);
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

function buildWsUrl(path: string, secret: string): string {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.BASE, (res) => {
      const base = (res[STORAGE_KEYS.BASE] || DEFAULT_BASE).replace(
        /^http/,
        "ws",
      );
      const url = `${base}${path}`;
      resolve(secret ? `${url}?token=${encodeURIComponent(secret)}` : url);
    });
  }).then((url) => url as unknown as string) as unknown as string;
}

function createWs(
  path: string,
  onMessage: (data: unknown) => void,
  onError?: (e: Event) => void,
): Promise<WebSocket> {
  return getApiBase()
    .then((base) =>
      getSecret().then((secret) => {
        const wsBase = base.replace(/^http/, "ws");
        const url = secret
          ? `${wsBase}${path}?token=${encodeURIComponent(secret)}`
          : `${wsBase}${path}`;
        const ws = new WebSocket(url);
        ws.onmessage = (e) => {
          try {
            onMessage(JSON.parse(e.data));
          } catch {
            onMessage(e.data);
          }
        };
        if (onError) ws.onerror = onError;
        return ws;
      }),
    );
}

export const clashApi = {
  async getConfig(): Promise<ClashConfig> {
    return request<ClashConfig>("/configs");
  },

  async getVersion(): Promise<{ version: string; meta: boolean; premium: boolean }> {
    return request("/version");
  },

  async reloadConfig(path?: string): Promise<void> {
    await request<void>("/configs", {
      method: "PUT",
      body: JSON.stringify(path ? { path } : { path: "" }),
    });
  },

  async getRules(): Promise<ClashRule[]> {
    const data = await request<RulesResponse>("/rules");
    return data.rules;
  },

  async getProxies(): Promise<ProxiesResponse> {
    return request<ProxiesResponse>("/proxies");
  },

  async switchProxy(groupName: string, proxyName: string): Promise<void> {
    await request<void>(`/proxies/${encodeURIComponent(groupName)}`, {
      method: "PUT",
      body: JSON.stringify({ name: proxyName }),
    });
  },

  async testDelay(
    groupName: string,
    url = "http://www.gstatic.com/generate_204",
    timeout = 3000,
  ): Promise<Record<string, { delay: number }>> {
    return request(
      `/group/${encodeURIComponent(groupName)}/delay?url=${encodeURIComponent(url)}&timeout=${timeout}`,
    );
  },

  async getConnections(): Promise<ConnectionsData> {
    return request<ConnectionsData>("/connections");
  },

  async closeConnection(id: string): Promise<void> {
    await request<void>(`/connections/${id}`, { method: "DELETE" });
  },

  async closeAllConnections(): Promise<void> {
    await request<void>("/connections", { method: "DELETE" });
  },

  async getProxyProviders(): Promise<ProxyProvidersResponse> {
    return request<ProxyProvidersResponse>("/providers/proxies");
  },

  async updateProvider(name: string): Promise<void> {
    await request<void>(`/providers/proxies/${encodeURIComponent(name)}`, {
      method: "PUT",
    });
  },

  async healthCheckProvider(name: string): Promise<void> {
    await request<void>(
      `/providers/proxies/${encodeURIComponent(name)}/healthcheck`,
      { method: "GET" },
    );
  },

  async ping(): Promise<boolean> {
    try {
      await this.getConfig();
      return true;
    } catch {
      return false;
    }
  },

  subscribeTraffic(
    onUpdate: (data: TrafficData) => void,
    onError?: (e: Event) => void,
  ): Promise<WebSocket> {
    return createWs("/traffic", onUpdate as (d: unknown) => void, onError);
  },

  subscribeConnections(
    onUpdate: (data: ConnectionsData) => void,
    onError?: (e: Event) => void,
  ): Promise<WebSocket> {
    return createWs("/connections", onUpdate as (d: unknown) => void, onError);
  },

  subscribeLogs(
    onUpdate: (data: LogEntry) => void,
    onError?: (e: Event) => void,
  ): Promise<WebSocket> {
    return createWs("/logs", onUpdate as (d: unknown) => void, onError);
  },

  async addRulesToProfile(
    rules: Array<{ type: string; payload: string; proxy: string }>,
  ): Promise<{ ok: boolean; count: number; uid?: string; error?: string }> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.BRIDGE, (res) => {
        const bridge = res[STORAGE_KEYS.BRIDGE] || DEFAULT_BRIDGE;
        resolve(bridge);
      });
    }).then(async (bridge) => {
      const ruleStrings = rules.map(
        (r) =>
          `${r.type},${r.payload}${r.type === "MATCH" ? "" : "," + r.proxy}`,
      );

      const res = await fetch(
        `${bridge}/commands/extension/rules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rules: ruleStrings }),
        },
      );

      const data = await res.json().catch(() => ({ error: "invalid response" }));

      if (!res.ok || data.error) {
        return {
          ok: false,
          count: 0,
          error: data.error || `HTTP ${res.status}`,
        };
      }

      return { ok: true, count: data.count ?? rules.length, uid: data.uid };
    });
  },

  async getIpInfo(): Promise<IpInfo & { lastFetchTs: number }> {
    const bridge = await new Promise<string>((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.BRIDGE, (res) => {
        resolve(res[STORAGE_KEYS.BRIDGE] || DEFAULT_BRIDGE);
      });
    });

    const res = await fetch(`${bridge}/commands/extension/ip-info`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    return { ...data, lastFetchTs: Date.now() };
  },

  async getSystemInfo(): Promise<SystemInfo> {
    const bridge = await new Promise<string>((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.BRIDGE, (res) => {
        resolve(res[STORAGE_KEYS.BRIDGE] || DEFAULT_BRIDGE);
      });
    });

    const res = await fetch(`${bridge}/commands/extension/system-info`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },
};

export { STORAGE_KEYS, DEFAULT_BASE, DEFAULT_BRIDGE };
