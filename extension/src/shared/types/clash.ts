export interface ClashVersion {
  version: string;
  premium: boolean;
  meta: boolean;
}

export interface ClashConfig {
  port: number;
  "socks-port": number;
  "redir-port": number;
  "mixed-port": number;
  "allow-lan": boolean;
  mode: string;
  "log-level": string;
  tun?: {
    enable: boolean;
  };
}

export interface ClashRule {
  type: RuleType;
  payload: string;
  proxy: string;
  size?: number;
  noResolve?: boolean;
}

export type RuleType =
  | "DOMAIN"
  | "DOMAIN-SUFFIX"
  | "DOMAIN-KEYWORD"
  | "DOMAIN-REGEX"
  | "IP-CIDR"
  | "IP-CIDR6"
  | "IP-SUFFIX"
  | "SRC-IP-CIDR"
  | "GEOIP"
  | "GEOSITE"
  | "SRC-GEOIP"
  | "DST-PORT"
  | "SRC-PORT"
  | "PROCESS-NAME"
  | "PROCESS-PATH"
  | "MATCH"
  | "FINAL"
  | "RULE-SET"
  | "AND"
  | "OR"
  | "NOT";

export interface ProxyNode {
  name: string;
  type: string;
  udp: boolean;
  history: Array<{ time: string; delay: number }>;
  alive: boolean;
  now?: string;
}

export interface ProxyGroup extends ProxyNode {
  now: string;
  all?: string[];
}

export interface ProxiesResponse {
  proxies: Record<string, ProxyNode | ProxyGroup>;
}

export interface RulesResponse {
  rules: ClashRule[];
}

export interface TrafficData {
  up: number;
  down: number;
}

export interface ConnectionMeta {
  network: string;
  type: string;
  sourceIP: string;
  destinationIP: string;
  sourcePort: string;
  destinationPort: string;
  host: string;
  processPath?: string;
  dnsMode?: string;
}

export interface Connection {
  id: string;
  metadata: ConnectionMeta;
  upload: number;
  download: number;
  start: string;
  chains: string[];
  rule: string;
  rulePayload: string;
}

export interface ConnectionsData {
  downloadTotal: number;
  uploadTotal: number;
  connections: Connection[];
  memory?: number;
}

export interface ProxyProvider {
  name: string;
  type: string;
  vehicleType: string;
  proxies: ProxyNode[];
  updatedAt: string;
  subscriptionInfo?: {
    Upload: number;
    Download: number;
    Total: number;
    Expire: number;
  };
}

export interface ProxyProvidersResponse {
  providers: Record<string, ProxyProvider>;
}

export interface LogEntry {
  type: string;
  payload: string;
}

export interface RuleMatchResult {
  matched: boolean;
  rule: ClashRule | null;
  ruleIndex: number;
  allRules: ClashRule[];
}

export interface ProfileEntry {
  path: string;
  name: string;
  active: boolean;
}

export type MonitorMatchMode = "full" | "suffix";

export interface MonitorRequest {
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
  mode?: MonitorMatchMode;
}

export interface IpInfo {
  ip: string;
  country_code: string;
  country: string;
  region: string;
  city: string;
  organization: string;
  isp: string;
  asn: number;
  asn_organization: string;
  longitude: number;
  latitude: number;
  timezone: string;
}

export interface SystemInfo {
  autoLaunch: boolean;
  runningMode: string;
  vergeVersion: string;
}
