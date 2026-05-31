import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { clashApi } from "../../shared/api/clash";
import type { MonitorMatchMode, MonitorRequest } from "../../shared/types/clash";
import { extractBaseDomain } from "../../shared/utils/domain-extract";
import { matchRule, ruleTypeLabel } from "../../shared/utils/rule-parser";
import { useProxies, useActiveTabHostname, useRules, sortProxyGroups } from "../hooks/useApi";

function getProblems(): Promise<MonitorRequest[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_PROBLEMS" }, (res) => {
      resolve(res?.problems ?? []);
    });
  });
}

function clearProblems(): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CLEAR_PROBLEMS" }, () => resolve());
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 60);
  if (s < 60) return `${s}秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分钟前`;
  return `${Math.floor(m / 60)}小时前`;
}

function getStatusIcon(req: MonitorRequest): string {
  if (req.failed && req.status === 0) return "✕";
  if (req.status >= 500) return "⚠";
  if (req.duration >= 1500) return "⏱";
  return "•";
}

function getStatusColor(req: MonitorRequest): string {
  if (req.failed && req.status === 0) return "text-red-400";
  if (req.status >= 500) return "text-yellow-400";
  if (req.duration >= 1500) return "text-orange-400";
  return "text-gray-400";
}

function getStatusLabel(req: MonitorRequest): string {
  if (req.failed && req.status === 0) {
    const errMap: Record<string, string> = {
      "net::ERR_CONNECTION_TIMED_OUT": "连接超时",
      "net::ERR_CONNECTION_REFUSED": "连接拒绝",
      "net::ERR_NAME_NOT_RESOLVED": "DNS解析失败",
      "net::ERR_INTERNET_DISCONNECTED": "网络断开",
      "net::ERR_PROXY_CONNECTION_FAILED": "代理连接失败",
      "net::ERR_TIMED_OUT": "超时",
      "net::ERR_BLOCKED_BY_CLIENT": "已拦截",
    };
    return errMap[req.error ?? ""] ?? req.error ?? "请求失败";
  }
  if (req.status >= 500) return `HTTP ${req.status}`;
  if (req.duration >= 1500) return `慢 ${formatDuration(req.duration)}`;
  return `${req.status}`;
}

function normType(t: string): string {
  return t.toUpperCase().replace(/[_\s]/g, "-");
}

interface GroupedHost {
  hostname: string;
  baseDomain: string;
  requests: MonitorRequest[];
  failedCount: number;
  slowCount: number;
  lastTimestamp: number;
}

export function CurrentSite() {
  const [problems, setProblems] = useState<MonitorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHosts, setSelectedHosts] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<MonitorMatchMode>("suffix");
  const [perHostMode, setPerHostMode] = useState<Record<string, MonitorMatchMode>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [targetProxy, setTargetProxy] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [quickAdding, setQuickAdding] = useState(false);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);
  const { groups } = useProxies();
  const { rules } = useRules();
  const activeHostname = useActiveTabHostname();

  const sortedGroups = useMemo(() => sortProxyGroups(groups), [groups]);
  const proxyNames = useMemo(() => sortedGroups.map((g) => g.name), [sortedGroups]);

  useEffect(() => {
    if (proxyNames.length > 0 && !targetProxy) {
      const prefer = proxyNames.find((n) =>
        n.toLowerCase().includes("auto") ||
        n.toLowerCase().includes("select") ||
        n === "PROXY",
      );
      setTargetProxy(prefer ?? proxyNames[0]);
    }
  }, [proxyNames, targetProxy]);

  const activeSiteRuleMatch = useMemo(() => {
    if (!activeHostname || !rules.length) return null;
    const result = matchRule(activeHostname, rules);
    if (!result.matched || !result.rule) return { matched: false };
    const t = normType(result.rule.type);
    if (t === "MATCH" || t === "FINAL") return { matched: false };
    return {
      matched: true,
      rule: result.rule,
      ruleType: ruleTypeLabel(result.rule.type),
      index: result.index,
    };
  }, [activeHostname, rules]);

  const refresh = useCallback(async () => {
    const data = await getProblems();
    setProblems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  const filteredProblems = useMemo(() => {
    return problems.filter((req) => {
      if (req.error === "net::ERR_BLOCKED_BY_CLIENT") return false;
      if (!rules.length) return true;
      const result = matchRule(req.hostname, rules);
      if (!result.matched || !result.rule) return true;
      const t = normType(result.rule.type);
      if (t === "MATCH" || t === "FINAL") return true;
      return false;
    });
  }, [problems, rules]);

  const grouped = useMemo<GroupedHost[]>(() => {
    const hostMap = new Map<string, MonitorRequest[]>();
    for (const req of filteredProblems) {
      const existing = hostMap.get(req.hostname) ?? [];
      existing.push(req);
      hostMap.set(req.hostname, existing);
    }
    return Array.from(hostMap.entries())
      .map(([hostname, reqs]) => ({
        hostname,
        baseDomain: extractBaseDomain(hostname),
        requests: reqs,
        failedCount: reqs.filter((r) => r.failed && r.status === 0).length,
        slowCount: reqs.filter((r) => r.duration >= 1500 || r.status >= 500).length,
        lastTimestamp: Math.max(...reqs.map((r) => r.timestamp)),
      }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [filteredProblems]);

  const toggleHost = (hostname: string) => {
    setSelectedHosts((prev) => {
      const next = new Set(prev);
      if (next.has(hostname)) next.delete(hostname);
      else next.add(hostname);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedHosts.size === grouped.length) {
      setSelectedHosts(new Set());
    } else {
      setSelectedHosts(new Set(grouped.map((g) => g.hostname)));
    }
  };

  const getModeForHost = (hostname: string): MonitorMatchMode =>
    perHostMode[hostname] ?? mode;

  const setHostMode = (hostname: string, m: MonitorMatchMode) => {
    setPerHostMode((prev) => ({ ...prev, [hostname]: m }));
  };

  const computeRules = useCallback(() => {
    const seen = new Set<string>();
    const rules: { type: string; payload: string; proxy: string }[] = [];
    for (const host of grouped) {
      if (!selectedHosts.has(host.hostname)) continue;
      const hostMode = getModeForHost(host.hostname);
      const payload = hostMode === "full" ? host.hostname : extractBaseDomain(host.hostname);
      const type = hostMode === "full" ? "DOMAIN" : "DOMAIN-SUFFIX";
      const key = `${type},${payload}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push({ type, payload, proxy: targetProxy });
    }
    return rules;
  }, [grouped, selectedHosts, targetProxy, perHostMode, mode]);

  const ruleCount = useMemo(() => computeRules().length, [computeRules]);

  const submitRules = async () => {
    if (selectedHosts.size === 0 || !targetProxy) return;
    setSubmitting(true);
    const rulesPayload = computeRules();
    try {
      const result = await clashApi.addRulesToProfile(rulesPayload);
      if (result.ok) {
        setSuccessCount(result.count ?? rulesPayload.length);
        setSuccess(true);
        await clearProblems();
        setSelectedHosts(new Set());
        setProblems([]);
        setTimeout(() => setSuccess(false), 2500);
      } else {
        alert(`添加规则失败: ${result.error}`);
      }
    } catch (err) {
      alert(
        `添加规则失败: ${err instanceof Error ? err.message : err}\n\n请确认 Clash Verge Rev 已在运行。`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAddCurrent = async () => {
    if (!activeHostname || !targetProxy) return;
    setQuickAdding(true);
    const baseDomain = extractBaseDomain(activeHostname);
    const payload = mode === "full" ? activeHostname : baseDomain;
    const type = mode === "full" ? "DOMAIN" : "DOMAIN-SUFFIX";
    try {
      const result = await clashApi.addRulesToProfile([{ type, payload, proxy: targetProxy }]);
      if (result.ok) {
        setQuickAddSuccess(true);
        setTimeout(() => setQuickAddSuccess(false), 2500);
      } else {
        alert(`添加失败: ${result.error}`);
      }
    } catch (err) {
      alert(`添加失败: ${err instanceof Error ? err.message : err}`);
    } finally {
      setQuickAdding(false);
    }
  };

  const handleClearAll = async () => {
    await clearProblems();
    setProblems([]);
    setSelectedHosts(new Set());
  };

  if (loading) {
    return (
      <div className="text-center text-text-secondary text-sm py-8 animate-pulse">
        正在加载...
      </div>
    );
  }

  if (success) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-16"
      >
        <div className="text-5xl mb-3">✧</div>
        <div className="text-sakura-200 text-lg font-medium font-rounded">
          规则已添加成功~♪
        </div>
        <div className="text-text-secondary text-xs mt-2">
          {successCount} 条规则已写入增强文件并激活
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">站点规则</span>
      </div>

      {activeHostname ? (
        <div className={`anime-card p-3 ${activeSiteRuleMatch?.matched ? "border-green-400/30" : "border-yellow-400/30"}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-2 h-2 rounded-full shrink-0 ${activeSiteRuleMatch?.matched ? "bg-green-400" : "bg-yellow-400"}`} />
              <span className="text-xs font-medium text-text-primary truncate">
                {activeHostname}
              </span>
            </div>
            {activeSiteRuleMatch?.matched ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 shrink-0 whitespace-nowrap">
                已有规则
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 shrink-0">
                未配置规则
              </span>
            )}
          </div>

          {activeSiteRuleMatch?.matched && activeSiteRuleMatch.rule && (
            <div className="text-[9px] text-text-secondary mb-2 flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-lavender-300/15 text-lavender-300">
                {activeSiteRuleMatch.ruleType}
              </span>
              <span className="truncate">{activeSiteRuleMatch.rule.payload}</span>
              <span className="text-text-secondary opacity-50">→</span>
              <span className="text-text-secondary truncate">{activeSiteRuleMatch.rule.proxy}</span>
            </div>
          )}

          <div className="flex gap-1.5 items-center">
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-2 py-1 rounded-md border border-sakura-200/20 bg-anime-bg-card hover:border-sakura-200/40 transition-all"
              >
                <span className="text-[10px] text-text-primary truncate">
                  {targetProxy || "选择代理组"}
                </span>
                <span className={`text-[8px] text-text-secondary transition-transform ${dropdownOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              {dropdownOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto scrollbar-thin rounded-md border border-sakura-200/20 bg-anime-bg-card shadow-lg">
                  {proxyNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => { setTargetProxy(name); setDropdownOpen(false); }}
                      className={`w-full text-left px-2 py-1 text-[10px] hover:bg-sakura-200/10 transition-colors ${name === targetProxy ? "text-sakura-200 bg-sakura-200/5" : "text-text-primary"}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-0.5 shrink-0">
              <button
                onClick={() => setMode("suffix")}
                className={`px-1.5 py-1 rounded text-[9px] transition-all ${
                  mode === "suffix"
                    ? "bg-sakura-200/20 text-sakura-200 border border-sakura-200/30"
                    : "bg-anime-bg-card text-text-secondary border border-transparent"
                }`}
              >
                *.后缀
              </button>
              <button
                onClick={() => setMode("full")}
                className={`px-1.5 py-1 rounded text-[9px] transition-all ${
                  mode === "full"
                    ? "bg-sakura-200/20 text-sakura-200 border border-sakura-200/30"
                    : "bg-anime-bg-card text-text-secondary border border-transparent"
                }`}
              >
                完整域名
              </button>
            </div>

            <button
              onClick={handleQuickAddCurrent}
              disabled={quickAdding || !targetProxy || !!activeSiteRuleMatch?.matched}
              className={`anime-btn shrink-0 text-[10px] disabled:opacity-40 ${
                quickAddSuccess ? "text-green-400" : ""
              }`}
            >
              {quickAdding ? "..." : quickAddSuccess ? "已添加" : "+ 添加"}
            </button>
          </div>

          <div className="text-[9px] text-text-secondary opacity-60 mt-1.5">
            {mode === "suffix"
              ? `将添加 DOMAIN-SUFFIX,${extractBaseDomain(activeHostname)} → ${targetProxy}`
              : `将添加 DOMAIN,${activeHostname} → ${targetProxy}`
            }
          </div>
        </div>
      ) : (
        <div className="anime-card p-4 text-center">
          <div className="text-text-secondary text-xs">无法获取当前页面地址</div>
        </div>
      )}

      {grouped.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] font-medium text-text-secondary">
              问题域名 <span className="text-text-secondary opacity-60">({grouped.length} 个未匹配规则)</span>
            </span>
            <div className="flex gap-1">
              <button onClick={toggleAll} className="anime-btn px-2 py-1 text-[10px]">
                {selectedHosts.size === grouped.length ? "取消全选" : "全选"}
              </button>
              <button onClick={handleClearAll} className="anime-btn px-2 py-1 text-[10px] text-red-400">
                清空
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {grouped.map((host) => {
              const isSel = selectedHosts.has(host.hostname);
              const hostMode = getModeForHost(host.hostname);
              return (
                <motion.div
                  key={host.hostname}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    toggleHost(host.hostname);
                  }}
                  className={`anime-card p-2.5 cursor-pointer select-none transition-all ${
                    isSel ? "border-sakura-200/50 bg-sakura-200/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSel
                          ? "border-sakura-200 bg-sakura-200/20"
                          : "border-white/20 bg-transparent"
                      }`}
                    >
                      {isSel && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#FFB7C5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{host.hostname}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondary">
                        <span>{host.requests.length} 次</span>
                        {host.failedCount > 0 && (
                          <span className="text-red-400">失败 {host.failedCount}</span>
                        )}
                        {host.slowCount > 0 && (
                          <span className="text-orange-400">慢 {host.slowCount}</span>
                        )}
                        <span className="opacity-60">{timeAgo(host.lastTimestamp)}</span>
                      </div>

                      <div className="flex gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setHostMode(host.hostname, "suffix"); }}
                          className={`px-1.5 py-0.5 rounded text-[9px] transition-all ${
                            hostMode === "suffix"
                              ? "bg-sakura-200/20 text-sakura-200 border border-sakura-200/30"
                              : "bg-anime-bg-card text-text-secondary border border-transparent hover:border-sakura-200/20"
                          }`}
                        >
                          *.{host.baseDomain}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setHostMode(host.hostname, "full"); }}
                          className={`px-1.5 py-0.5 rounded text-[9px] transition-all ${
                            hostMode === "full"
                              ? "bg-sakura-200/20 text-sakura-200 border border-sakura-200/30"
                              : "bg-anime-bg-card text-text-secondary border border-transparent hover:border-sakura-200/20"
                          }`}
                        >
                          {host.hostname}
                        </button>
                      </div>

                      <div className="mt-1.5 space-y-0.5">
                        {host.requests.slice(0, 3).map((req) => (
                          <div key={req.id} className="flex items-center gap-1.5 text-[9px] opacity-70">
                            <span className={getStatusColor(req)}>{getStatusIcon(req)}</span>
                            <span className="text-text-secondary">{req.method}</span>
                            <span className="text-text-secondary truncate flex-1">
                              {new URL(req.url).pathname.slice(0, 40)}
                            </span>
                            <span className={getStatusColor(req)}>{getStatusLabel(req)}</span>
                          </div>
                        ))}
                        {host.requests.length > 3 && (
                          <div className="text-[9px] text-text-secondary opacity-50">
                            ... 还有 {host.requests.length - 3} 条
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {ruleCount > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="sticky bottom-0 z-10 px-3 py-2 -mx-3 bg-anime-bg-panel/95 backdrop-blur-sm border-t border-sakura-200/10"
            >
              <button
                onClick={submitRules}
                disabled={submitting || !targetProxy}
                className="anime-btn anime-btn-primary w-full text-center disabled:opacity-40"
              >
                {submitting ? "添加中..." : `✧ 添加 ${ruleCount} 条规则到 ${targetProxy}`}
              </button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
