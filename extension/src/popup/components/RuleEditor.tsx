import { useState } from "react";
import type { RuleType } from "../../shared/types/clash";

interface Props {
  onSubmit: (type: RuleType, payload: string, proxy: string) => void;
  proxyOptions: string[];
  initialType?: RuleType;
  initialPayload?: string;
}

const RULE_TYPES: { value: RuleType; label: string }[] = [
  { value: "DOMAIN", label: "精确域名 (DOMAIN)" },
  { value: "DOMAIN-SUFFIX", label: "域名后缀 (DOMAIN-SUFFIX)" },
  { value: "DOMAIN-KEYWORD", label: "关键字 (DOMAIN-KEYWORD)" },
  { value: "IP-CIDR", label: "IPv4 CIDR" },
  { value: "IP-CIDR6", label: "IPv6 CIDR" },
  { value: "GEOIP", label: "GeoIP" },
  { value: "PROCESS-NAME", label: "进程名" },
];

export function RuleEditor({
  onSubmit,
  proxyOptions,
  initialType = "DOMAIN-SUFFIX",
  initialPayload = "",
}: Props) {
  const [type, setType] = useState<RuleType>(initialType);
  const [payload, setPayload] = useState(initialPayload);
  const [proxy, setProxy] = useState(proxyOptions[0] ?? "");

  const handleSubmit = () => {
    if (!payload.trim() || !proxy) return;
    onSubmit(type, payload.trim(), proxy);
  };

  return (
    <div className="anime-card p-4 space-y-3">
      <div>
        <label className="text-[11px] text-text-secondary block mb-1">
          规则类型
        </label>
        <select
          className="anime-input"
          value={type}
          onChange={(e) => setType(e.target.value as RuleType)}
        >
          {RULE_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>
              {rt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[11px] text-text-secondary block mb-1">
          匹配值
        </label>
        <input
          className="anime-input"
          placeholder="例: github.com"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
        />
      </div>
      <div>
        <label className="text-[11px] text-text-secondary block mb-1">
          代理组
        </label>
        <select
          className="anime-input"
          value={proxy}
          onChange={(e) => setProxy(e.target.value)}
        >
          {proxyOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!payload.trim() || !proxy}
        className="anime-btn anime-btn-primary w-full text-center disabled:opacity-40 disabled:pointer-events-none"
      >
        ✧ 添加规则
      </button>
    </div>
  );
}
