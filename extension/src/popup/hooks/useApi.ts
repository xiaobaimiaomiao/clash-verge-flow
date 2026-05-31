import { useCallback, useEffect, useRef, useState } from "react";
import { clashApi } from "../../shared/api/clash";
import type {
  ClashConfig,
  ClashRule,
  ConnectionsData,
  ProxyGroup,
  ProxyNode,
  ProxiesResponse,
} from "../../shared/types/clash";
import { matchRule } from "../../shared/utils/rule-parser";
import { useAppStore } from "../../shared/store";

export function useApiReady() {
  const [ready, setReady] = useState(false);
  const setApiOnline = useAppStore((s) => s.setApiOnline);

  useEffect(() => {
    let cancelled = false;
    clashApi.ping().then((ok) => {
      if (!cancelled) {
        setReady(ok);
        setApiOnline(ok);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setApiOnline]);

  const refresh = useCallback(async () => {
    const ok = await clashApi.ping();
    setReady(ok);
    setApiOnline(ok);
    return ok;
  }, [setApiOnline]);

  return { ready, refresh };
}

export function useConfig() {
  const [config, setConfig] = useState<ClashConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clashApi.getConfig();
      setConfig(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { config, loading, error, refetch: fetch };
}

export function useRules() {
  const [rules, setRules] = useState<ClashRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clashApi.getRules();
      setRules(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取规则失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rules, loading, error, refetch: fetch };
}

export function useCurrentSiteMatch(hostname: string | null) {
  const { rules, loading } = useRules();
  const result = hostname
    ? matchRule(hostname, rules)
    : { matched: false, rule: null, index: -1 };

  return {
    ...result,
    allRules: rules,
    loading,
  };
}

export function useProxies() {
  const [data, setData] = useState<ProxiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await clashApi.getProxies();
      setData(res);
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "获取代理信息失败");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const groups: Record<string, ProxyGroup> = {};
  const nodes: Record<string, ProxyNode> = {};
  if (data) {
    for (const [name, proxy] of Object.entries(data.proxies)) {
      if ("all" in proxy && proxy.all) {
        groups[name] = proxy as ProxyGroup;
      } else {
        nodes[name] = proxy as ProxyNode;
      }
    }
  }

  const switchProxy = useCallback(
    async (groupName: string, proxyName: string) => {
      await clashApi.switchProxy(groupName, proxyName);
      await fetch(true);
    },
    [fetch],
  );

  return { proxies: data, groups, nodes, loading, error, refetch: () => fetch(), switchProxy };
}

export function useActiveTabHostname(): string | null {
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs?.[0]?.url;
      if (url) {
        try {
          setHostname(new URL(url).hostname);
        } catch {
          setHostname(null);
        }
      }
    });
  }, []);

  return hostname;
}

export function useTraffic() {
  const [history, setHistory] = useState<{ up: number; down: number; t: number }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let mounted = true;
    clashApi.subscribeTraffic(
      (data) => {
        if (!mounted) return;
        const { up, down } = data as { up: number; down: number };
        setHistory((prev) => {
          const next = [...prev, { up, down, t: Date.now() }];
          return next.slice(-60);
        });
      },
      () => {},
    ).then((ws) => {
      if (!mounted) { ws.close(); return; }
      ws.onerror = () => {};
      ws.onclose = () => {};
      wsRef.current = ws;
    }).catch(() => {});

    return () => {
      mounted = false;
      try { wsRef.current?.close(); } catch {}
    };
  }, []);

  const latest = history.length > 0 ? history[history.length - 1] : { up: 0, down: 0 };
  return { history, up: latest.up, down: latest.down };
}

export function useConnectionsInfo() {
  const [data, setData] = useState<{
    uploadTotal: number;
    downloadTotal: number;
    activeCount: number;
  }>({ uploadTotal: 0, downloadTotal: 0, activeCount: 0 });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let mounted = true;
    clashApi
      .subscribeConnections((d) => {
        if (!mounted) return;
        const c = d as ConnectionsData;
        setData({
          uploadTotal: c.uploadTotal,
          downloadTotal: c.downloadTotal,
          activeCount: c.connections?.length ?? 0,
        });
      })
      .then((ws) => {
        if (!mounted) { ws.close(); return; }
        ws.onerror = () => {};
        ws.onclose = () => {};
        wsRef.current = ws;
      })
      .catch(() => {});
    return () => {
      mounted = false;
      try { wsRef.current?.close(); } catch {}
    };
  }, []);

  return data;
}

export function useMemory() {
  const [mem, setMem] = useState<{ inuse: number }>({ inuse: 0 });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let mounted = true;
    const connect = async () => {
      try {
        const base = await new Promise<string>((resolve) => {
          chrome.storage.local.get("clash_api_base", (res) => {
            resolve(res.clash_api_base || "http://127.0.0.1:9090");
          });
        });
        const secret = await new Promise<string>((resolve) => {
          chrome.storage.local.get("clash_api_secret", (res) => {
            resolve(res.clash_api_secret || "set-your-secret");
          });
        });
        const wsBase = base.replace(/^http/, "ws");
        const url = secret
          ? `${wsBase}/memory?token=${encodeURIComponent(secret)}`
          : `${wsBase}/memory`;
        const ws = new WebSocket(url);
        ws.onerror = () => {};
        ws.onclose = () => {};
        ws.onmessage = (e) => {
          if (!mounted) return;
          try {
            const d = JSON.parse(e.data);
            setMem({ inuse: d.inuse ?? 0 });
          } catch {}
        };
        wsRef.current = ws;
      } catch {}
    };
    connect();
    return () => {
      mounted = false;
      try { wsRef.current?.close(); } catch {}
    };
  }, []);

  return mem;
}

export function sortProxyGroups(
  groups: Record<string, ProxyGroup>,
): ProxyGroup[] {
  return Object.values(groups).sort((a, b) => {
    const aGlobal = a.name === "GLOBAL" ? 1 : 0;
    const bGlobal = b.name === "GLOBAL" ? 1 : 0;
    if (aGlobal !== bGlobal) return aGlobal - bGlobal;
    return 0;
  });
}
