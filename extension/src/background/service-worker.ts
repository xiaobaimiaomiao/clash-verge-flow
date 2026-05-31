const CHECK_INTERVAL = 30000;
const API_BASE_DEFAULT = "http://127.0.0.1:9090";

interface ProblemRequest {
  id: string;
  url: string;
  hostname: string;
  method: string;
  type: string;
  timestamp: number;
  duration: number;
  status: number;
  failed: boolean;
  error?: string;
  selected?: boolean;
  mode?: "full" | "suffix";
}

const requestTimestamps = new Map<string, number>();
const problemRequests: ProblemRequest[] = [];
const MAX_PROBLEMS = 100;
const SLOW_THRESHOLD = 1500;

const IGNORE_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "clients2.google.com",
  "clients3.google.com",
  "clients4.google.com",
]);

let activeTabId: number = -1;

function updateActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const newId = tabs[0]?.id ?? -1;
    if (newId !== activeTabId) {
      activeTabId = newId;
      problemRequests.length = 0;
      requestTimestamps.clear();
    }
  });
}

chrome.tabs.onActivated.addListener(() => updateActiveTab());
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    activeTabId = -1;
    problemRequests.length = 0;
    requestTimestamps.clear();
  }
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.status === "loading") {
    problemRequests.length = 0;
    requestTimestamps.clear();
  }
});

updateActiveTab();

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId !== activeTabId) return;
    const hostname = extractHostname(details.url);
    if (!hostname || IGNORE_HOSTS.has(hostname)) return;
    if (hostname.startsWith("127.") || hostname.startsWith("192.168.")) return;

    requestTimestamps.set(details.requestId, Date.now());
  },
  { urls: ["<all_urls>"] },
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId !== activeTabId) return;
    const startTime = requestTimestamps.get(details.requestId);
    if (!startTime) return;
    requestTimestamps.delete(details.requestId);

    const duration = Date.now() - startTime;
    if (duration < SLOW_THRESHOLD && details.statusCode < 500) return;

    const hostname = extractHostname(details.url);
    if (!hostname) return;

    const record: ProblemRequest = {
      id: generateId(),
      url: details.url,
      hostname,
      method: details.method || "GET",
      type: details.type || "other",
      timestamp: startTime,
      duration,
      status: details.statusCode,
      failed: details.statusCode >= 500 || duration >= SLOW_THRESHOLD,
      mode: "suffix",
    };

    problemRequests.unshift(record);
    if (problemRequests.length > MAX_PROBLEMS) {
      problemRequests.pop();
    }
  },
  { urls: ["<all_urls>"] },
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.tabId !== activeTabId) return;
    const startTime = requestTimestamps.get(details.requestId);
    if (!startTime) return;
    requestTimestamps.delete(details.requestId);

    const hostname = extractHostname(details.url);
    if (!hostname) return;

    if (details.error === "net::ERR_BLOCKED_BY_CLIENT") return;

    const duration = Date.now() - startTime;

    const record: ProblemRequest = {
      id: generateId(),
      url: details.url,
      hostname,
      method: details.method || "GET",
      type: details.type || "other",
      timestamp: startTime,
      duration,
      status: 0,
      failed: true,
      error: details.error,
      mode: "suffix",
    };

    problemRequests.unshift(record);
    if (problemRequests.length > MAX_PROBLEMS) {
      problemRequests.pop();
    }
  },
  { urls: ["<all_urls>"] },
);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_PROBLEMS") {
    sendResponse({ problems: [...problemRequests] });
  } else if (msg.type === "CLEAR_PROBLEMS") {
    problemRequests.length = 0;
    sendResponse({ ok: true });
  }
  return true;
});

async function getConfig(): Promise<{ base: string; secret: string }> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["clash_api_base", "clash_api_secret"], (res) => {
      resolve({
        base: res.clash_api_base || API_BASE_DEFAULT,
        secret: res.clash_api_secret || "set-your-secret",
      });
    });
  });
}

async function isClashOnline(): Promise<boolean> {
  try {
    const { base, secret } = await getConfig();
    const headers: Record<string, string> = {};
    if (secret) headers["Authorization"] = `Bearer ${secret}`;
    const res = await fetch(`${base}/version`, { headers, signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchJson(
  base: string,
  path: string,
  secret: string,
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (secret) headers["Authorization"] = `Bearer ${secret}`;
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function checkHealth() {
  try {
    const { base, secret } = await getConfig();
    await fetchJson(base, "/configs", secret);
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#4ade80" });
    chrome.action
      .setIcon({ path: { "48": "public/icons/icon-48.png" } })
      .catch(() => {});
  } catch {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#f87171" });
    chrome.action
      .setIcon({ path: { "48": "public/icons/icon-offline-48.png" } })
      .catch(() => {
        chrome.action
          .setIcon({ path: { "48": "public/icons/icon-48.png" } })
          .catch(() => {});
      });
  }
}

async function updateBadgeFromProxies() {
  try {
    const { base, secret } = await getConfig();
    const data = (await fetchJson(base, "/proxies", secret)) as {
      proxies: Record<string, { now?: string; all?: string[] }>;
    };
    const globalProxy = data.proxies["GLOBAL"];
    if (globalProxy?.now) {
      const short = globalProxy.now.slice(0, 6);
      chrome.action.setBadgeText({ text: short });
      chrome.action.setBadgeBackgroundColor({ color: "#FFB7C5" });
    }
  } catch {}
}

async function updateBadgeProblemCount() {
  const pending = problemRequests.filter((p) => !p.selected).length;
  if (pending > 0) {
    chrome.action.setBadgeText({ text: String(pending) });
    chrome.action.setBadgeBackgroundColor({ color: "#fbbf24" });
  }
}

async function checkTrafficLevel() {
  try {
    if (!(await isClashOnline())) return;
    const { base, secret } = await getConfig();
    const wsBase = base.replace(/^http/, "ws");
    const url = secret
      ? `${wsBase}/traffic?token=${encodeURIComponent(secret)}`
      : `${wsBase}/traffic`;
    const ws = new WebSocket(url);
    ws.onerror = () => {};
    ws.onclose = () => {};
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const total = (data.up || 0) + (data.down || 0);
        if (total > 10 * 1024 * 1024) {
          chrome.action.setBadgeBackgroundColor({ color: "#fb923c" });
        }
      } catch {}
    };
    setTimeout(() => { try { ws.close(); } catch {} }, 5000);
  } catch {}
}

chrome.runtime.onInstalled.addListener(() => {
  checkHealth();
  setInterval(checkHealth, CHECK_INTERVAL);
  setInterval(updateBadgeFromProxies, CHECK_INTERVAL);
  setInterval(checkTrafficLevel, 60000);
  setInterval(updateBadgeProblemCount, 10000);
});

chrome.runtime.onStartup.addListener(() => {
  checkHealth();
});
