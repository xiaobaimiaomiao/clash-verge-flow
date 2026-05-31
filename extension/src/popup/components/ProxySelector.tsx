import type { ProxyGroup, ProxyNode } from "../../shared/types/clash";
import { DelayBadge } from "./DelayBadge";

interface Props {
  group: ProxyGroup;
  nodes: Record<string, ProxyNode>;
  delays: Record<string, number>;
  onSwitch: (groupName: string, nodeName: string) => Promise<void>;
}

export function ProxySelector({ group, nodes, delays, onSwitch }: Props) {
  const nodeList = group.all ?? [];

  if (nodeList.length === 0) {
    return (
      <div className="text-center text-text-secondary text-xs py-6">
        该代理组暂无节点
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {nodeList.map((nodeName) => {
        const node = nodes[nodeName];
        const isCurrent = group.now === nodeName;
        const lastHistoryDelay = node?.history?.length
          ? node.history[node.history.length - 1].delay
          : 0;
        const delay = delays[nodeName] && delays[nodeName] > 0
          ? delays[nodeName]
          : lastHistoryDelay;
        const alive = node?.alive ?? false;

        return (
          <button
            key={nodeName}
            onClick={() => onSwitch(group.name, nodeName)}
            className={`relative text-left px-2 py-1.5 rounded-lg text-[11px] transition-all border ${
              isCurrent
                ? "bg-sakura-200/15 border-sakura-200/40 shadow-[0_0_0_1px_rgba(255,183,197,0.2)]"
                : "bg-anime-bg-card border-transparent hover:border-sakura-200/20"
            }`}
          >
            {isCurrent && (
              <div className="absolute top-1 right-1">
                <div className="w-1.5 h-1.5 rounded-full bg-sakura-200 animate-pulse" />
              </div>
            )}

            <div
              className={`truncate ${isCurrent ? "text-sakura-200 font-medium pr-2" : "text-text-primary"}`}
              title={nodeName}
            >
              {nodeName}
            </div>

            <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-1 text-[9px]">
                {node?.type && (
                  <span className="text-text-secondary">{node.type}</span>
                )}
                {alive && (
                  <span className="inline-block w-1 h-1 rounded-full bg-green-400" />
                )}
              </div>
              {delay > 0 ? <DelayBadge delay={delay} /> : <DelayBadge delay={0} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
