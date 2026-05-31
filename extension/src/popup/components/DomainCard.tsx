import { motion } from "framer-motion";
import { useState } from "react";
import { useActiveTabHostname } from "../hooks/useApi";
import { useCurrentSiteMatch } from "../hooks/useApi";
import { extractBaseDomain, extractDomain } from "../../shared/utils/domain-extract";
import { ruleTypeIcon, ruleTypeLabel } from "../../shared/utils/rule-parser";
import { QuickAdd } from "./QuickAdd";

export function DomainCard() {
  const hostname = useActiveTabHostname();
  const [showAdd, setShowAdd] = useState(false);
  const { matched, rule, index, allRules, loading } =
    useCurrentSiteMatch(hostname);

  if (!hostname) {
    return (
      <div className="anime-card p-4 text-center">
        <p className="text-text-secondary text-xs">
          无法获取当前标签页域名
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="anime-card p-4 text-center">
        <div className="text-sakura-200 animate-pulse text-sm">检测中...</div>
      </div>
    );
  }

  const baseDomain = extractBaseDomain(hostname);

  return (
    <div>
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="anime-card p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🌍</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{hostname}</div>
            <div className="text-[10px] text-text-secondary">
              基础域名: {baseDomain}
            </div>
          </div>
        </div>

        {matched && rule ? (
          <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-1.5 text-xs">
              <span>✓</span>
              <span className="text-green-400">命中规则 #{index + 1}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-secondary">
              <span>
                {ruleTypeIcon(rule.type)} {ruleTypeLabel(rule.type)}
              </span>
              <span className="text-sakura-200">→</span>
              <span className="text-sky-300">{rule.proxy}</span>
            </div>
            <div className="text-[10px] text-text-secondary mt-1 truncate">
              {rule.payload}
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400 mb-2">
              未匹配特定规则（走兜底）
            </div>
            <button onClick={() => setShowAdd(true)} className="anime-btn anime-btn-primary w-full text-center">
              ✧ 一键添加规则
            </button>
          </div>
        )}
      </motion.div>

      {showAdd && (
        <QuickAdd
          hostname={hostname}
          baseDomain={baseDomain}
          proxyGroups={allRules.map((r) => r.proxy).filter((v, i, a) => a.indexOf(v) === i)}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
