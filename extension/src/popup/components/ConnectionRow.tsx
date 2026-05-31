import type { Connection } from "../../shared/types/clash";

interface Props {
  conn: Connection;
  onClose?: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 10 ** (i * 3)).toFixed(1)} ${units[i]}`;
}

function formatDuration(start: string): string {
  const ms = Date.now() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

export function ConnectionRow({ conn, onClose }: Props) {
  const host =
    conn.metadata.host || conn.metadata.destinationIP;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] border-b border-sakura-200/5 hover:bg-sakura-200/5 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate max-w-[140px]">{host}</span>
          <span className="text-[9px] px-1 py-0.5 rounded bg-lavender-300/20 text-lavender-300 shrink-0">
            {conn.metadata.network}
          </span>
        </div>
        <div className="text-[10px] text-text-secondary truncate mt-0.5">
          {conn.chains.join(" → ")} ·{" "}
          <span className="text-sky-300">{conn.rule}</span>
        </div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <div className="text-[10px]">
          <span className="text-sakura-200">↑</span>
          {formatBytes(conn.upload)}{" "}
          <span className="text-sky-300">↓</span>
          {formatBytes(conn.download)}
        </div>
        <div className="text-[9px] text-text-secondary">
          {formatDuration(conn.start)}
        </div>
      </div>
      {onClose && (
        <button
          onClick={() => onClose(conn.id)}
          className="text-red-400 hover:text-red-300 text-xs shrink-0 ml-1"
          title="关闭连接"
        >
          ✕
        </button>
      )}
    </div>
  );
}
