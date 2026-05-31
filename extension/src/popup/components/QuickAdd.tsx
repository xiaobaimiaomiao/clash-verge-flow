import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { RuleType } from "../../shared/types/clash";
import { RuleEditor } from "./RuleEditor";

interface Props {
  hostname: string;
  baseDomain: string;
  proxyGroups: string[];
  onClose: () => void;
}

export function QuickAdd({ hostname, baseDomain, proxyGroups, onClose }: Props) {
  const [mode, setMode] = useState<"exact" | "suffix" | "keyword">("suffix");
  const [payload, setPayload] = useState(baseDomain);
  const [selectedProxy, setSelectedProxy] = useState(proxyGroups[0] ?? "");
  const [success, setSuccess] = useState(false);

  const modeOptions = [
    { key: "suffix" as const, label: "后缀匹配", value: baseDomain },
    { key: "exact" as const, label: "精确匹配", value: hostname },
    { key: "keyword" as const, label: "关键字", value: baseDomain.split(".")[0] },
  ];

  const ruleTypeMap: Record<string, RuleType> = {
    suffix: "DOMAIN-SUFFIX",
    exact: "DOMAIN",
    keyword: "DOMAIN-KEYWORD",
  };

  const handleAdd = () => {
    setSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="anime-card p-4 mt-3"
      >
        {success ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center py-4"
          >
            <div className="text-3xl mb-2">✧</div>
            <div className="text-sakura-200 text-sm font-medium">
              规则添加成功~♪
            </div>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-sakura-200">
                快速添加规则
              </span>
              <button
                onClick={onClose}
                className="text-text-secondary hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-1 mb-3">
              {modeOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setMode(opt.key);
                    setPayload(opt.value);
                  }}
                  className={`flex-1 px-2 py-1.5 rounded text-[11px] transition-all ${
                    mode === opt.key
                      ? "bg-sakura-200/20 text-sakura-200 border border-sakura-200/30"
                      : "bg-anime-bg-card text-text-secondary border border-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <input
              className="anime-input mb-2"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />

            <select
              className="anime-input mb-3"
              value={selectedProxy}
              onChange={(e) => setSelectedProxy(e.target.value)}
            >
              {proxyGroups.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <button
              onClick={handleAdd}
              disabled={!payload.trim() || !selectedProxy}
              className="anime-btn anime-btn-primary w-full text-center disabled:opacity-40"
            >
              ✧ 确认添加
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
