import { useState } from "react";
import { RuleList } from "../components/RuleList";
import { RuleEditor } from "../components/RuleEditor";
import { useRules, useProxies } from "../hooks/useApi";

export function RuleManager() {
  const { rules, refetch: refetchRules } = useRules();
  const { groups } = useProxies();
  const [showAdd, setShowAdd] = useState(false);

  const proxyGroupNames = Object.keys(groups);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">
          规则管理
        </span>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="anime-btn anime-btn-primary text-[11px]"
        >
          {showAdd ? "取消" : "+ 添加规则"}
        </button>
      </div>

      {showAdd && (
        <RuleEditor
          proxyOptions={proxyGroupNames}
          onSubmit={async (type, payload, proxy) => {
            setShowAdd(false);
            refetchRules();
          }}
        />
      )}

      <RuleList rules={rules} />
    </div>
  );
}
