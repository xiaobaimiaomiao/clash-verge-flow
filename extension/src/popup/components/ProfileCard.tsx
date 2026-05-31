import type { ProfileEntry } from "../../shared/types/clash";

interface Props {
  profile: ProfileEntry;
  onSwitch: () => void;
}

export function ProfileCard({ profile, onSwitch }: Props) {
  return (
    <div
      className={`anime-card p-3 flex items-center gap-3 ${
        profile.active ? "border-sakura-200/40" : ""
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${
          profile.active
            ? "bg-green-400 shadow-[0_0_6px_#4ade80]"
            : "bg-gray-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{profile.name}</div>
        <div className="text-[10px] text-text-secondary truncate mt-0.5">
          {profile.path}
        </div>
      </div>
      {!profile.active && (
        <button onClick={onSwitch} className="anime-btn px-2 py-1 text-[10px] shrink-0">
          切换
        </button>
      )}
      {profile.active && (
        <span className="text-[10px] text-green-400 shrink-0">当前</span>
      )}
    </div>
  );
}
