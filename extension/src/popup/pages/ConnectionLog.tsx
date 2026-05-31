import { useEffect, useRef, useState } from "react";
import { ConnectionRow } from "../components/ConnectionRow";
import { clashApi } from "../../shared/api/clash";
import type { Connection, ConnectionsData } from "../../shared/types/clash";
import { useAppStore } from "../../shared/store";

export function ConnectionLog() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [totals, setTotals] = useState({ up: 0, down: 0 });
  const [search, setSearch] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const limit = useAppStore((s) => s.settings.connectionLimit);

  useEffect(() => {
    let mounted = true;
    clashApi
      .subscribeConnections((data) => {
        if (!mounted) return;
        const d = data as ConnectionsData;
        setConnections(d.connections.slice(0, limit));
        setTotals({ up: d.uploadTotal, down: d.downloadTotal });
      })
      .then((ws) => {
        wsRef.current = ws;
      });
    return () => {
      mounted = false;
      wsRef.current?.close();
    };
  }, [limit]);

  const handleClose = async (id: string) => {
    await clashApi.closeConnection(id);
  };

  const handleCloseAll = async () => {
    await clashApi.closeAllConnections();
  };

  const formatBytes = (b: number) => {
    if (b === 0) return "0 B";
    const u = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return `${(b / 1024 ** i).toFixed(1)} ${u[i]}`;
  };

  const filtered = search
    ? connections.filter(
        (c) =>
          (c.metadata.host ?? c.metadata.destinationIP)
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          c.chains.some((ch) =>
            ch.toLowerCase().includes(search.toLowerCase()),
          ),
      )
    : connections;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-text-secondary space-x-3">
          <span>
            连接: <b className="text-sakura-200">{connections.length}</b>
          </span>
          <span>
            ↑ <b className="text-sakura-200">{formatBytes(totals.up)}</b>
          </span>
          <span>
            ↓ <b className="text-sky-300">{formatBytes(totals.down)}</b>
          </span>
        </div>
        <button onClick={handleCloseAll} className="anime-btn text-[10px] px-2 py-1">
          清空所有
        </button>
      </div>

      <input
        className="anime-input text-xs"
        placeholder="🔍 搜索域名/代理..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="anime-card overflow-hidden max-h-[360px] overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="text-center text-text-secondary text-xs py-4">
            暂无活跃连接
          </div>
        ) : (
          filtered.map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              onClose={handleClose}
            />
          ))
        )}
      </div>
    </div>
  );
}
