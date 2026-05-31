interface Props {
  history: { up: number; down: number; t: number }[];
  width?: number;
  height?: number;
}

export function TrafficChart({ history, width = 340, height = 60 }: Props) {
  if (history.length < 2) {
    return (
      <div
        className="anime-card flex items-center justify-center text-text-secondary text-xs"
        style={{ width, height }}
      >
        等待流量数据...
      </div>
    );
  }

  const maxVal = Math.max(
    ...history.map((h) => Math.max(h.up, h.down)),
    1,
  );
  const step = width / (history.length - 1);

  const buildPath = (key: "up" | "down") => {
    return history
      .map((h, i) => {
        const x = i * step;
        const y = height - (h[key] / maxVal) * (height - 8) - 4;
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  };

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB7C5" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFB7C5" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#87CEEB" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#87CEEB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${buildPath("up")} L${width},${height} L0,${height} Z`}
        fill="url(#upGrad)"
      />
      <path
        d={`${buildPath("down")} L${width},${height} L0,${height} Z`}
        fill="url(#downGrad)"
      />
      <path d={buildPath("up")} fill="none" stroke="#FFB7C5" strokeWidth="1.5" />
      <path d={buildPath("down")} fill="none" stroke="#87CEEB" strokeWidth="1.5" />
    </svg>
  );
}
