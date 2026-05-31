import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useAppStore, type TabKey } from "../shared/store";
import { AnimatedBg } from "./components/AnimatedBg";
import { SakuraParticles } from "./components/SakuraParticles";
import { StatusBar } from "./components/StatusBar";
import { useApiReady } from "./hooks/useApi";

import { ConnectionLog } from "./pages/ConnectionLog";
import { CurrentSite } from "./pages/CurrentSite";
import { Dashboard } from "./pages/Dashboard";
import { ProfileSwitch } from "./pages/ProfileSwitch";
import { ProxyPanel } from "./pages/ProxyPanel";
import { RuleManager } from "./pages/RuleManager";
import { Settings } from "./pages/Settings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "概览" },
  { key: "site", label: "站点" },
  { key: "rules", label: "规则" },
  { key: "proxies", label: "代理" },
  { key: "connections", label: "连接" },
  { key: "providers", label: "订阅" },
  { key: "settings", label: "设置" },
];

const PAGES: Record<TabKey, React.ComponentType> = {
  dashboard: Dashboard,
  site: CurrentSite,
  rules: RuleManager,
  proxies: ProxyPanel,
  connections: ConnectionLog,
  providers: ProfileSwitch,
  profiles: ProfileSwitch,
  settings: Settings,
};

const pageVariants = {
  enter: { x: 20, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -20, opacity: 0 },
};

export function App() {
  const { activeTab, setActiveTab, settings, loadSettings, settingsLoaded } =
    useAppStore();
  const { ready, refresh } = useApiReady();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const PageComp = PAGES[activeTab] || Dashboard;

  if (!settingsLoaded) {
    return (
      <div className="relative w-[400px] h-[600px] bg-anime-bg flex items-center justify-center">
        <AnimatedBg />
        <div className="text-sakura-200 animate-pulse text-lg font-rounded">
          ✧ 加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-[400px] h-[600px] bg-anime-bg flex flex-col overflow-hidden">
      <AnimatedBg />
      {settings.particleEnabled && <SakuraParticles />}

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b border-sakura-200/10">
          <h1 className="font-rounded text-base font-bold bg-gradient-to-r from-sakura-200 to-lavender-300 bg-clip-text text-transparent">
            ✧ ClashFlow
          </h1>
          <button
            onClick={refresh}
            className="anime-btn px-2 py-1 text-xs"
            title="刷新连接"
          >
            ⟳
          </button>
        </div>

        <StatusBar online={ready} />

        <div className="flex items-center border-b border-sakura-200/10 px-2 gap-0.5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key ? "tab-active" : "tab-inactive"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <PageComp />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
