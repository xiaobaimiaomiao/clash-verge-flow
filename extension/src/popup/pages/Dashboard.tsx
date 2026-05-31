import { useEffect, useState } from "react";
import { TrafficChart } from "../components/TrafficChart";
import { DelayBadge } from "../components/DelayBadge";
import {
  useConfig,
  useTraffic,
  useProxies,
  useConnectionsInfo,
  useMemory,
  sortProxyGroups,
} from "../hooks/useApi";
import { clashApi } from "../../shared/api/clash";
import type { IpInfo, SystemInfo } from "../../shared/types/clash";

function fmtBytes(b: number): string {
  if (b === 0) return "0 B";
  if (b < 0) return "--";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  return `${(b / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function fmtSpeed(bps: number): string {
  return `${fmtBytes(bps)}/s`;
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-start px-2 py-1.5 min-w-0">
      <div className="text-[9px] text-text-secondary uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`text-xs font-medium truncate w-full ${color ?? "text-text-primary"}`}
      >
        {value}
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5 mt-2 first:mt-0">
      <span className="text-sm">{icon}</span>
      <span className="text-[11px] font-semibold text-text-primary">
        {title}
      </span>
      {sub && <span className="text-[10px] text-text-secondary">{sub}</span>}
    </div>
  );
}

export function Dashboard() {
  const { config } = useConfig();
  const { history, up, down } = useTraffic();
  const { groups, nodes } = useProxies();
  const connInfo = useConnectionsInfo();
  const mem = useMemory();

  const [version, setVersion] = useState<string>("--");
  const [ip, setIp] = useState<(IpInfo & { lastFetchTs: number }) | null>(null);
  const [ipLoading, setIpLoading] = useState(true);
  const [showIp, setShowIp] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [osInfo, setOsInfo] = useState("--");

  const fetchIp = () => {
    setIpLoading(true);
    clashApi
      .getIpInfo()
      .then((info) => {
        setIp(info);
        setCountdown(300);
      })
      .catch(() => {})
      .finally(() => setIpLoading(false));
  };

  useEffect(() => {
    clashApi.getVersion().then((v) => setVersion(v.version)).catch(() => {});
    clashApi.getSystemInfo().then(setSysInfo).catch(() => {});
    setOsInfo(getOsName());
    fetchIp();

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 5) {
          fetchIp();
          return 300;
        }
        return prev - 5;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const sortedGroups = sortProxyGroups(groups);
  const firstNonGlobal = sortedGroups.find((g) => g.name !== "GLOBAL");
  const currentGroup = firstNonGlobal ?? sortedGroups[0];
  const currentNodeName = currentGroup?.now;
  const currentNode = currentNodeName ? nodes[currentNodeName] : null;
  const nodeDelay =
    currentNode?.history?.length
      ? currentNode.history[currentNode.history.length - 1].delay
      : 0;

  return (
    <div className="space-y-1">
      <SectionTitle icon="🎯" title="当前代理" sub={config?.mode ?? ""} />
      <div className="anime-card p-2.5">
        {currentGroup ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-text-secondary">
                {currentGroup.type} · {currentGroup.name}
              </div>
              <div className="text-xs font-medium text-text-primary truncate">
                {currentNodeName ?? "--"}
              </div>
              {currentNode?.type && (
                <div className="text-[9px] text-text-secondary mt-0.5">
                  {currentNode.type}
                </div>
              )}
            </div>
            <DelayBadge delay={nodeDelay} />
          </div>
        ) : (
          <div className="text-xs text-text-secondary text-center py-1">
            --
          </div>
        )}
      </div>

      <SectionTitle icon="📊" title="流量统计" />
      <div className="anime-card p-1.5">
        <div className="grid grid-cols-3 gap-0">
          <StatItem
            label="上传"
            value={fmtSpeed(up)}
            color="text-sakura-200"
          />
          <StatItem
            label="下载"
            value={fmtSpeed(down)}
            color="text-sky-300"
          />
          <StatItem
            label="连接数"
            value={String(connInfo.activeCount)}
            color="text-lavender-300"
          />
          <StatItem label="总上传" value={fmtBytes(connInfo.uploadTotal)} />
          <StatItem label="总下载" value={fmtBytes(connInfo.downloadTotal)} />
          <StatItem label="内存" value={fmtBytes(mem.inuse)} />
        </div>
        <div className="mt-1.5 border-t border-sakura-200/10 pt-1.5">
          <TrafficChart history={history} height={70} />
        </div>
      </div>

      <SectionTitle icon="⚙️" title="Clash 信息" sub={version} />
      <div className="anime-card p-1.5">
        <div className="grid grid-cols-3 gap-0">
          <StatItem label="模式" value={config?.mode ?? "--"} />
          <StatItem
            label="混合端口"
            value={String(config?.["mixed-port"] ?? "--")}
          />
          <StatItem
            label="代理组"
            value={String(Object.keys(groups).length)}
          />
          <StatItem
            label="局域网"
            value={config?.["allow-lan"] ? "开" : "关"}
          />
          <StatItem label="日志" value={config?.["log-level"] ?? "--"} />
          <StatItem
            label="TUN"
            value={config?.tun?.enable ? "开" : "关"}
          />
        </div>
      </div>

      <SectionTitle icon="🌐" title="IP 信息" />
      <div className="anime-card p-2.5">
        {ipLoading || !ip ? (
          <div className="text-xs text-text-secondary text-center py-1 animate-pulse">
            获取中...
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-lg">
                    {getFlagEmoji(ip.country_code)}
                  </span>
                  <span className="text-xs font-medium text-text-primary truncate">
                    {ip.country || "Unknown"}
                  </span>
                </div>
                <InfoRow
                  label="IP"
                  value={showIp ? ip.ip : "••••••••••"}
                  onClick={() => setShowIp((v) => !v)}
                  mono
                />
                <InfoRow
                  label="自治域"
                  value={ip.asn ? `AS${ip.asn}` : "N/A"}
                />
              </div>
              <div className="flex-1 min-w-0">
                <InfoRow label="服务商" value={ip.organization} />
                <InfoRow label="组织" value={ip.asn_organization} />
                <InfoRow
                  label="位置"
                  value={[ip.city, ip.region].filter(Boolean).join(", ") || "Unknown"}
                />
                <InfoRow label="时区" value={ip.timezone} />
              </div>
            </div>
            <div className="flex items-center justify-between text-[9px] text-text-secondary border-t border-sakura-200/10 pt-1 mt-1 opacity-70">
              <button
                onClick={() => { setCountdown(0); fetchIp(); }}
                className="hover:text-sakura-200 cursor-pointer"
              >
                自动刷新：{countdown}s
              </button>
              <span className="truncate">
                {ip.country_code || "N/A"},{" "}
                {ip.longitude?.toFixed(2) ?? "N/A"},{" "}
                {ip.latitude?.toFixed(2) ?? "N/A"}
              </span>
            </div>
          </div>
        )}
      </div>

      <SectionTitle icon="💻" title="系统信息" />
      <div className="anime-card p-1.5">
        <div className="flex flex-col gap-1.5">
          <InfoRow label="操作系统信息" value={osInfo} />
          <div className="border-t border-sakura-200/5" />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-secondary">开机自启</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                sysInfo?.autoLaunch
                  ? "bg-green-500/20 text-green-400"
                  : "bg-gray-500/20 text-text-secondary"
              }`}
            >
              {sysInfo?.autoLaunch ? "已启用" : "已禁用"}
            </span>
          </div>
          <div className="border-t border-sakura-200/5" />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-secondary">运行模式</span>
            <span className="text-text-primary">{sysInfo?.runningMode ?? "--"}</span>
          </div>
          <div className="border-t border-sakura-200/5" />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-secondary">Verge 版本</span>
            <span className="text-text-primary">
              v{sysInfo?.vergeVersion ?? "--"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  onClick,
  mono,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start text-[10px] leading-tight">
      <span className="text-text-secondary shrink-0">{label}:</span>
      <span
        className={`ml-1 text-text-primary truncate ${mono ? "font-mono text-[9px]" : ""} ${onClick ? "cursor-pointer hover:text-sakura-200" : ""}`}
        onClick={onClick}
      >
        {value || "Unknown"}
      </span>
    </div>
  );
}

function getFlagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🏳️";
  const offset = 127397;
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => c.charCodeAt(0) + offset),
  );
}

function getOsName(): string {
  const ua = navigator.userAgent;
  const win = ua.match(/Windows NT (\d+\.\d+)/);
  if (win) {
    const v = win[1];
    const map: Record<string, string> = {
      "10.0": "Windows 10",
      "11.0": "Windows 11",
      "6.3": "Windows 8.1",
      "6.1": "Windows 7",
    };
    return map[v] || `Windows ${v}`;
  }
  const mac = ua.match(/Mac OS X ([\d_.]+)/);
  if (mac) return `macOS ${mac[1].replace(/_/g, ".")}`;
  const linux = ua.match(/Linux ([^\s)]+)/);
  if (linux) return `Linux ${linux[1]}`;
  return navigator.platform ?? "Unknown";
}
