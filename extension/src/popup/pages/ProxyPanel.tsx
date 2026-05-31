import { useState, useCallback, useEffect, useRef } from "react";
import { ProxySelector } from "../components/ProxySelector";
import { clashApi } from "../../shared/api/clash";
import { useProxies, sortProxyGroups } from "../hooks/useApi";
import { useAppStore } from "../../shared/store";

export function ProxyPanel() {
  const { groups, nodes, loading, error, switchProxy } = useProxies();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [delays, setDelays] = useState<Record<string, number>>({});
  const delayTestUrl = useAppStore((s) => s.settings.delayTestUrl);
  const testedGroupsRef = useRef<Set<string>>(new Set());

  const sortedGroups = sortProxyGroups(groups);
  const current =
    sortedGroups.find((g) => g.name === activeGroup) ??
    sortedGroups.find((g) => g.name !== "GLOBAL") ??
    sortedGroups[0];

  const testGroupDelay = useCallback(
    async (groupName: string) => {
      if (testedGroupsRef.current.has(groupName)) return;
      testedGroupsRef.current.add(groupName);
      setTesting(true);
      try {
        const result = await clashApi.testDelay(groupName, delayTestUrl, 5000);
        setDelays((prev) => {
          const next = { ...prev };
          for (const [nodeName, data] of Object.entries(result)) {
            if (typeof data === "object" && data !== null && "delay" in data) {
              next[nodeName] = (data as { delay: number }).delay;
            }
          }
          return next;
        });
      } catch {
        testedGroupsRef.current.delete(groupName);
      }
      setTesting(false);
    },
    [delayTestUrl],
  );

  useEffect(() => {
    if (loading || !sortedGroups.length) return;
    const initial =
      sortedGroups.find((g) => g.name !== "GLOBAL") ?? sortedGroups[0];
    if (initial) testGroupDelay(initial.name);
    // run once on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (current && !testedGroupsRef.current.has(current.name)) {
      testGroupDelay(current.name);
    }
  }, [current, testGroupDelay]);

  const testCurrentGroupDelay = useCallback(async () => {
    if (!current) return;
    testedGroupsRef.current.delete(current.name);
    setTesting(true);
    try {
      const result = await clashApi.testDelay(current.name, delayTestUrl, 5000);
      setDelays((prev) => {
        const next = { ...prev };
        for (const [nodeName, data] of Object.entries(result)) {
          if (typeof data === "object" && data !== null && "delay" in data) {
            next[nodeName] = (data as { delay: number }).delay;
          }
        }
        return next;
      });
    } catch {}
    setTesting(false);
  }, [current, delayTestUrl]);

  if (loading) {
    return (
      <div className="text-center text-text-secondary text-sm py-8 animate-pulse">
        加载代理信息...
      </div>
    );
  }
  if (error) {
    return <div className="text-center text-red-400 text-sm py-8">{error}</div>;
  }

  if (sortedGroups.length === 0) {
    return (
      <div className="text-center text-text-secondary text-xs py-8">
        暂无代理组
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {sortedGroups.map((g) => (
          <button
            key={g.name}
            onClick={() => setActiveGroup(g.name)}
            className={`px-2 py-1 rounded-md text-[11px] whitespace-nowrap transition-all shrink-0 ${
              current?.name === g.name
                ? "bg-sakura-200/20 text-sakura-200 border border-sakura-200/30"
                : "bg-anime-bg-card text-text-secondary border border-transparent hover:border-sakura-200/20"
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {current && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-text-primary truncate">
                {current.name}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-lavender-300/15 text-lavender-300 shrink-0">
                {current.type}
              </span>
              {current.now && (
                <span className="text-[9px] text-text-secondary truncate">
                  · {current.now}
                </span>
              )}
            </div>
            <button
              onClick={testCurrentGroupDelay}
              disabled={testing}
              className="anime-btn text-[10px] disabled:opacity-50 shrink-0"
            >
              {testing ? "测试中..." : "⟳ 测延迟"}
            </button>
          </div>

          <ProxySelector
            group={current}
            nodes={nodes}
            delays={delays}
            onSwitch={switchProxy}
          />
        </>
      )}
    </div>
  );
}
