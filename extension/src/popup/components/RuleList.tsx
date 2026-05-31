import { useState } from "react";
import { motion } from "framer-motion";
import { clashApi } from "../../shared/api/clash";
import { ruleTypeIcon, ruleTypeLabel } from "../../shared/utils/rule-parser";
import type { ClashRule } from "../../shared/types/clash";

interface Props {
  rules: ClashRule[];
}

export function RuleList({ rules }: Props) {
  const [search, setSearch] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const filtered = search
    ? rules.filter(
        (r) =>
          r.payload.toLowerCase().includes(search.toLowerCase()) ||
          r.proxy.toLowerCase().includes(search.toLowerCase()) ||
          r.type.includes(search.toUpperCase()),
      )
    : rules;

  const grouped = filtered.reduce<Record<string, ClashRule[]>>((acc, rule) => {
    const key = rule.proxy;
    if (!acc[key]) acc[key] = [];
    acc[key].push(rule);
    return acc;
  }, {});

  const groupEntries = Object.entries(grouped).sort(
    (a, b) => b[1].length - a[1].length,
  );

  return (
    <div>
      <input
        className="anime-input mb-3"
        placeholder="🔍 搜索规则..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="text-[10px] text-text-secondary mb-2">
        共 {rules.length} 条规则 {search && `· 筛选 ${filtered.length} 条`}
      </div>
      <div className="space-y-1">
        {groupEntries.map(([proxy, groupRules]) => (
          <div key={proxy} className="anime-card overflow-hidden">
            <button
              onClick={() =>
                setExpandedGroup(expandedGroup === proxy ? null : proxy)
              }
              className="w-full flex items-center justify-between px-3 py-2 text-xs"
            >
              <span className="font-medium truncate">{proxy}</span>
              <span className="flex items-center gap-1 text-text-secondary">
                <span className="bg-sakura-200/20 text-sakura-200 px-1.5 py-0.5 rounded text-[10px]">
                  {groupRules.length}
                </span>
                <span
                  className={`transition-transform ${expandedGroup === proxy ? "rotate-90" : ""}`}
                >
                  ►
                </span>
              </span>
            </button>
            {expandedGroup === proxy && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="border-t border-sakura-200/10"
              >
                {groupRules.map((rule, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] border-b border-sakura-200/5 last:border-0 hover:bg-sakura-200/5"
                  >
                    <span>{ruleTypeIcon(rule.type)}</span>
                    <span className="text-lavender-300 text-[10px] w-16 shrink-0">
                      {ruleTypeLabel(rule.type)}
                    </span>
                    <span className="flex-1 truncate text-text-secondary">
                      {rule.payload}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
