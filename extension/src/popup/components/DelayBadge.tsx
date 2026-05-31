interface Props {
  delay: number;
}

export function DelayBadge({ delay }: Props) {
  if (delay <= 0) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-gray-500/20 text-gray-400">
        --
      </span>
    );
  }

  const color =
    delay < 200
      ? "bg-green-500/20 text-green-400"
      : delay < 500
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-red-500/20 text-red-400";

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${color}`}>
      {delay}ms
    </span>
  );
}
