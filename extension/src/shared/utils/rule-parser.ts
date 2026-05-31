import type { ClashRule, RuleType } from "../types/clash";

export function parseRuleString(raw: string): ClashRule | null {
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length < 2) return null;

  const type = parts[0] as RuleType;
  const payload = parts[1];
  const proxy = parts[2] ?? "";
  const noResolve = parts.includes("no-resolve");

  return { type, payload, proxy, noResolve };
}

function normalizeType(t: string): string {
  return t.toUpperCase().replace(/_/g, "-");
}

export function matchRule(
  hostname: string,
  rules: ClashRule[],
): { matched: boolean; rule: ClashRule | null; index: number } {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const type = normalizeType(rule.type);
    switch (type) {
      case "DOMAIN":
        if (hostname === rule.payload) {
          return { matched: true, rule, index: i };
        }
        break;
      case "DOMAIN-SUFFIX":
      case "DOMAINSUFFIX":
        if (
          hostname === rule.payload ||
          hostname.endsWith(`.${rule.payload}`)
        ) {
          return { matched: true, rule, index: i };
        }
        break;
      case "DOMAIN-KEYWORD":
      case "DOMAINKEYWORD":
        if (hostname.includes(rule.payload)) {
          return { matched: true, rule, index: i };
        }
        break;
      case "DOMAIN-REGEX":
      case "DOMAINREGEX":
        try {
          if (new RegExp(rule.payload).test(hostname)) {
            return { matched: true, rule, index: i };
          }
        } catch {
          // ignore invalid regex
        }
        break;
      case "GEOSITE":
        if (hostname.includes(rule.payload)) {
          return { matched: true, rule, index: i };
        }
        break;
      case "MATCH":
      case "FINAL":
        return { matched: true, rule, index: i };
    }
  }
  return { matched: false, rule: null, index: -1 };
}

export function ruleTypeLabel(type: RuleType): string {
  const labels: Record<string, string> = {
    DOMAIN: "精确域名",
    "DOMAIN-SUFFIX": "后缀匹配",
    "DOMAIN-KEYWORD": "关键字",
    "DOMAIN-REGEX": "正则匹配",
    "IP-CIDR": "IPv4段",
    "IP-CIDR6": "IPv6段",
    GEOIP: "GeoIP",
    GEOSITE: "GeoSite",
    "DST-PORT": "目标端口",
    "SRC-PORT": "来源端口",
    "PROCESS-NAME": "进程名",
    "PROCESS-PATH": "进程路径",
    MATCH: "兜底规则",
    FINAL: "兜底规则",
    "RULE-SET": "规则集",
    AND: "AND组合",
    OR: "OR组合",
    NOT: "NOT取反",
  };
  return labels[type] ?? type;
}

export function ruleTypeIcon(type: RuleType): string {
  const icons: Record<string, string> = {
    DOMAIN: "🌐",
    "DOMAIN-SUFFIX": "🏷️",
    "DOMAIN-KEYWORD": "🔑",
    "DOMAIN-REGEX": "📐",
    "IP-CIDR": "📡",
    "IP-CIDR6": "📡",
    GEOIP: "🗺️",
    GEOSITE: "🗺️",
    "PROCESS-NAME": "⚙️",
    MATCH: "🎯",
    FINAL: "🎯",
  };
  return icons[type] ?? "📋";
}
