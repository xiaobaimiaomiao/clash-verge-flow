import { motion } from "framer-motion";

const MASCOT_STATES = {
  online: { emoji: "◕‿◕", text: "连接成功啦~♪", color: "text-green-400" },
  offline: { emoji: "◕︵◕", text: "Clash 没在运行...", color: "text-red-400" },
  slow: { emoji: "◕_◕", text: "延迟有点高呢~", color: "text-yellow-400" },
};

interface Props {
  online: boolean;
}

export function StatusBar({ online }: Props) {
  const state = online ? MASCOT_STATES.online : MASCOT_STATES.offline;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-anime-bg-panel/60">
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="text-2xl select-none"
      >
        {state.emoji.replace(/◕/g, online ? "◕‿◕" : "◕︵◕").split(" ")[0]}
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium ${state.color}`}>{state.text}</div>
        <div className="text-[10px] text-text-secondary/60 mt-0.5">
          {online ? "API 已连接" : "无法连接 API"}
        </div>
      </div>
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          online ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-red-400 shadow-[0_0_6px_#f87171]"
        }`}
      />
    </div>
  );
}
